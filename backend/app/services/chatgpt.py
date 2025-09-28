from __future__ import annotations

import json
import logging
from typing import Any, List, Optional, Sequence

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

try:  # pragma: no cover - optional dependency wrapper
    from openai import OpenAI, OpenAIError
except ModuleNotFoundError:  # pragma: no cover - executed when SDK missing
    OpenAI = None  # type: ignore[misc, assignment]

    class OpenAIError(Exception):
        """Fallback error raised when the OpenAI SDK is unavailable."""


from .. import models
from ..config import settings
from ..database import get_db
from ..schemas import AnalysisRequest, AnalysisResponse, UserProfile
from ..utils.secrets import SecretEncryptionKeyError, get_secret_cipher
from .llm_shared import (
    APPEAL_SYSTEM_PROMPT,
    LLMConfigurationError,
    LLMError,
    SYSTEM_PROMPT,
    build_analysis_schema,
    build_user_prompt,
    fallback_card,
    parse_card,
    parse_json_payload,
)

logger = logging.getLogger(__name__)


class ChatGPTError(LLMError):
    """Base exception for ChatGPT integration errors."""


class ChatGPTConfigurationError(ChatGPTError, LLMConfigurationError):
    """Raised when required configuration for ChatGPT is missing."""


class ChatGPTClient:
    """Real ChatGPT client that transforms notes into structured proposals."""

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.model = model or settings.chatgpt_model
        self.api_key = api_key

        if not self.api_key:
            raise ChatGPTConfigurationError("ChatGPT API key is not configured. Update it from the admin settings.")

        if OpenAI is None:
            raise ChatGPTConfigurationError(
                "OpenAI SDK is not installed. Install the 'openai' package to enable analysis."
            )

        self._client = OpenAI(api_key=self.api_key)

    def analyze(
        self,
        request: AnalysisRequest,
        *,
        user_profile: UserProfile | None = None,
    ) -> AnalysisResponse:
        text = request.text.strip()
        if not text:
            return AnalysisResponse(model=self.model, proposals=[])

        try:
            payload = self._request_analysis(text, request.max_cards, user_profile)
        except OpenAIError as exc:
            logger.exception("ChatGPT request failed")
            raise ChatGPTError("ChatGPT request failed.") from exc
        except json.JSONDecodeError as exc:
            logger.exception("Unable to decode ChatGPT response")
            raise ChatGPTError("ChatGPT returned an invalid response.") from exc

        raw_proposals = payload.get("proposals", [])
        if not isinstance(raw_proposals, Sequence) or isinstance(raw_proposals, (str, bytes)):
            raw_proposals = []

        proposals = [card for card in (parse_card(item, text) for item in raw_proposals) if card is not None]

        if not proposals:
            proposals.append(fallback_card(text))

        model_name = payload.get("model") if isinstance(payload, dict) else None
        return AnalysisResponse(model=model_name or self.model, proposals=proposals[: request.max_cards])

    def generate_appeal(
        self,
        *,
        prompt: str,
        response_schema: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke the Responses API to craft appeal narratives."""

        if not prompt.strip():
            raise ChatGPTError("Prompt for appeal generation must not be empty.")

        try:
            response = self._client.responses.create(
                model=self.model,
                instructions=APPEAL_SYSTEM_PROMPT,
                input=prompt,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "appeal_generation_response",
                        "strict": True,
                        "schema": response_schema,
                    },
                },
            )
        except OpenAIError as exc:
            logger.exception("ChatGPT appeal generation failed")
            raise ChatGPTError("ChatGPT request failed.") from exc

        content = self._extract_content(response)
        data = parse_json_payload(content)
        if not isinstance(data, dict):
            raise ChatGPTError("ChatGPT response must be a JSON object.")

        payload = dict(data)
        if not payload.get("model") and getattr(response, "model", None):
            payload["model"] = response.model

        usage = self._extract_usage(response)
        if usage:
            existing_usage = payload.get("token_usage")
            if isinstance(existing_usage, dict):
                merged = dict(existing_usage)
                merged.update({key: value for key, value in usage.items() if key not in merged})
                payload["token_usage"] = merged
            else:
                payload["token_usage"] = usage

        return payload

    def _request_analysis(
        self,
        text: str,
        max_cards: int,
        user_profile: UserProfile | None = None,
    ) -> dict[str, Any]:
        response_format = self._build_response_format(max_cards)
        user_prompt = build_user_prompt(text, max_cards, user_profile)

        response = self._client.responses.create(
            model=self.model,
            instructions=SYSTEM_PROMPT,
            input=user_prompt,
            response_format=response_format,
        )

        content = self._extract_content(response)
        data = parse_json_payload(content)
        if not isinstance(data, dict):
            raise ChatGPTError("ChatGPT response must be a JSON object.")
        if (not data.get("model")) and getattr(response, "model", None):
            enriched = dict(data)
            enriched["model"] = response.model
            return enriched
        return data

    def _build_response_format(self, max_cards: int) -> dict[str, Any]:
        schema = build_analysis_schema(max_cards)
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "analysis_response",
                "strict": True,
                "schema": schema,
            },
        }

    def _extract_usage(self, response: Any) -> dict[str, int]:
        usage = getattr(response, "usage", None)
        if not usage:
            return {}

        def _value(source: Any, key: str) -> Any:
            if isinstance(source, dict):
                return source.get(key)
            return getattr(source, key, None)

        result: dict[str, int] = {}
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            value = _value(usage, key)
            if value is None and hasattr(usage, "get"):
                value = usage.get(key)
            if value is None and hasattr(usage, "to_dict"):
                try:
                    value = usage.to_dict().get(key)  # type: ignore[call-arg]
                except Exception:  # pragma: no cover - defensive
                    value = None
            if value is None:
                continue
            try:
                result[key] = int(value)
            except (TypeError, ValueError):
                continue
        return result

    def _extract_content(self, response: Any) -> str:
        if getattr(response, "output", None):
            fragments: List[str] = []
            for item in response.output:  # type: ignore[attr-defined]
                for chunk in getattr(item, "content", []) or []:
                    text = getattr(chunk, "text", None)
                    if not text:
                        continue

                    if isinstance(text, str):
                        fragments.append(text)
                        continue

                    value = getattr(text, "value", None)
                    if value is not None:
                        fragments.append(value)
            if fragments:
                return "".join(fragments)

        if getattr(response, "output_text", None):
            return response.output_text  # type: ignore[attr-defined]

        choices = getattr(response, "choices", None)
        if choices:
            first_message = getattr(choices[0], "message", None)
            if first_message and getattr(first_message, "content", None):
                return first_message.content


        raise ChatGPTError("ChatGPT response did not contain any text output.")


def _load_chatgpt_configuration(db: Session, provider: str = "openai") -> tuple[str, str]:
    credential = (
        db.query(models.ApiCredential)
        .filter(
            models.ApiCredential.provider == provider,
            models.ApiCredential.is_active.is_(True),
        )
        .first()
    )
    if not credential:
        disabled_credential_exists = (
            db.query(models.ApiCredential)
            .filter(
                models.ApiCredential.provider == provider,
                models.ApiCredential.is_active.is_(False),
            )
            .first()
            is not None
        )
        if disabled_credential_exists:
            raise ChatGPTConfigurationError("ChatGPT API key is disabled. Update it from the admin settings.")

        if settings.chatgpt_api_key:
            return settings.chatgpt_api_key, settings.chatgpt_model

        raise ChatGPTConfigurationError("ChatGPT API key is not configured. Update it from the admin settings.")

    try:
        cipher = get_secret_cipher()
    except SecretEncryptionKeyError as exc:
        raise ChatGPTConfigurationError(str(exc)) from exc
    try:
        secret = cipher.decrypt(credential.encrypted_secret)
    except Exception as exc:  # pragma: no cover - defensive path
        logger.exception("Failed to decrypt API credential for provider '%s'", provider)
        raise ChatGPTConfigurationError("Failed to decrypt ChatGPT API key.") from exc

    if not secret:
        raise ChatGPTConfigurationError("ChatGPT API key is not configured. Update it from the admin settings.")

    model = credential.model or settings.chatgpt_model
    return secret, model


def _load_chatgpt_api_key(db: Session, provider: str = "openai") -> str:
    secret, _ = _load_chatgpt_configuration(db, provider)
    return secret


def get_chatgpt_client(db: Session = Depends(get_db)) -> ChatGPTClient:
    try:
        api_key, model = _load_chatgpt_configuration(db)
        return ChatGPTClient(api_key=api_key, model=model)
    except ChatGPTConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def get_optional_chatgpt_client(db: Session = Depends(get_db)) -> ChatGPTClient | None:
    try:
        return get_chatgpt_client(db)
    except HTTPException:
        return None
