"""Gemini-powered analysis and appeal generation services."""

from __future__ import annotations

import json
import logging
from typing import Any, Sequence

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

try:  # pragma: no cover - optional dependency wrapper
    import google.generativeai as genai
    from google.api_core.exceptions import GoogleAPIError
except ModuleNotFoundError:  # pragma: no cover - executed when SDK missing
    genai = None  # type: ignore[assignment]

    class GoogleAPIError(Exception):
        """Fallback error raised when the Gemini SDK is unavailable."""


from .. import models
from ..config import settings
from ..database import get_db
from ..schemas import AnalysisRequest, AnalysisResponse, UserProfile
from ..utils.secrets import SecretEncryptionKeyError, get_secret_cipher
from .chatgpt import ChatGPTClient, ChatGPTConfigurationError, _load_chatgpt_configuration
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


class GeminiError(LLMError):
    """Base exception for Gemini integration errors."""


class GeminiConfigurationError(GeminiError, LLMConfigurationError):
    """Raised when Gemini is misconfigured or disabled."""

    def __init__(self, message: str, *, allow_fallback: bool = False) -> None:
        super().__init__(message)
        self.allow_fallback = allow_fallback


class GeminiClient:
    """Gemini client mirroring the ChatGPT integration behaviour."""

    def __init__(self, model: str | None = None, api_key: str | None = None) -> None:
        self.model = model or settings.gemini_model
        self.api_key = api_key or settings.gemini_api_key

        if not self.api_key:
            raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

        if genai is None:
            raise GeminiConfigurationError(
                "Google Generative AI SDK is not installed. Install the 'google-generativeai' package to enable analysis."
            )

        genai.configure(api_key=self.api_key)
        self._analysis_model = genai.GenerativeModel(model_name=self.model, system_instruction=SYSTEM_PROMPT)
        self._appeal_model = genai.GenerativeModel(model_name=self.model, system_instruction=APPEAL_SYSTEM_PROMPT)

    def analyze(
        self,
        request: AnalysisRequest,
        *,
        user_profile: UserProfile | None = None,
    ) -> AnalysisResponse:
        text = request.text.strip()
        if not text:
            return AnalysisResponse(model=self.model, proposals=[])

        schema = build_analysis_schema(request.max_cards)
        prompt = build_user_prompt(text, request.max_cards, user_profile)
        config = self._build_generation_config(schema)

        try:
            response = self._analysis_model.generate_content(prompt, generation_config=config)
        except GoogleAPIError as exc:  # pragma: no cover - network failure path
            logger.exception("Gemini analysis request failed")
            raise GeminiError("Gemini request failed.") from exc

        content = self._extract_content(response)
        try:
            data = parse_json_payload(content)
        except json.JSONDecodeError as exc:
            logger.exception("Unable to decode Gemini response")
            raise GeminiError("Gemini returned an invalid response.") from exc

        if not isinstance(data, dict):
            raise GeminiError("Gemini response must be a JSON object.")

        raw_proposals = data.get("proposals", [])
        if not isinstance(raw_proposals, Sequence) or isinstance(raw_proposals, (str, bytes)):
            raw_proposals = []

        proposals = [card for card in (parse_card(item, text) for item in raw_proposals) if card is not None]

        if not proposals:
            proposals.append(fallback_card(text))

        model_name = data.get("model") if isinstance(data, dict) else None
        if not model_name and getattr(response, "model", None):
            model_name = response.model

        payload_model = model_name or self.model
        return AnalysisResponse(model=payload_model, proposals=proposals[: request.max_cards])

    def generate_appeal(
        self,
        *,
        prompt: str,
        response_schema: dict[str, Any],
    ) -> dict[str, Any]:
        if not prompt.strip():
            raise GeminiError("Prompt for appeal generation must not be empty.")

        config = self._build_generation_config(response_schema)
        try:
            response = self._appeal_model.generate_content(prompt, generation_config=config)
        except GoogleAPIError as exc:  # pragma: no cover - network failure path
            logger.exception("Gemini appeal generation failed")
            raise GeminiError("Gemini request failed.") from exc

        content = self._extract_content(response)
        try:
            payload = parse_json_payload(content)
        except json.JSONDecodeError as exc:
            logger.exception("Unable to decode Gemini response")
            raise GeminiError("Gemini returned an invalid response.") from exc

        if not isinstance(payload, dict):
            raise GeminiError("Gemini response must be a JSON object.")

        if not payload.get("model") and getattr(response, "model", None):
            payload = dict(payload)
            payload["model"] = response.model

        usage = self._extract_usage(response)
        if usage:
            existing = payload.get("token_usage")
            if isinstance(existing, dict):
                merged = dict(existing)
                merged.update({key: value for key, value in usage.items() if key not in merged})
                payload["token_usage"] = merged
            else:
                payload["token_usage"] = usage

        return payload

    def _build_generation_config(self, schema: dict[str, Any]) -> Any:
        if genai is None:  # pragma: no cover - handled earlier
            return {
                "response_mime_type": "application/json",
                "response_schema": schema,
            }

        if hasattr(genai, "GenerationConfig"):
            return genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=schema,
            )

        return {
            "response_mime_type": "application/json",
            "response_schema": schema,
        }

    def _extract_content(self, response: Any) -> str:
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text

        candidates = getattr(response, "candidates", None)
        if candidates:
            for candidate in candidates:
                content = getattr(candidate, "content", None)
                parts = getattr(content, "parts", None) if content else None
                if parts:
                    for part in parts:
                        value = getattr(part, "text", None)
                        if value:
                            return value
        raise GeminiError("Gemini response did not contain any text output.")

    def _extract_usage(self, response: Any) -> dict[str, int]:
        usage = getattr(response, "usage_metadata", None)
        if not usage:
            return {}

        result: dict[str, int] = {}
        mappings = {
            "prompt_token_count": "prompt_tokens",
            "candidates_token_count": "completion_tokens",
            "total_token_count": "total_tokens",
        }
        for source_key, target_key in mappings.items():
            value = getattr(usage, source_key, None)
            if value is None and isinstance(usage, dict):
                value = usage.get(source_key)
            if value is None and hasattr(usage, "to_dict"):
                try:
                    value = usage.to_dict().get(source_key)  # type: ignore[call-arg]
                except Exception:  # pragma: no cover - defensive
                    value = None
            if value is None:
                continue
            try:
                result[target_key] = int(value)
            except (TypeError, ValueError):
                continue
        return result


def _load_gemini_configuration(db: Session) -> tuple[str, str]:
    credential = (
        db.query(models.ApiCredential)
        .filter(
            models.ApiCredential.provider == "gemini",
            models.ApiCredential.is_active.is_(True),
        )
        .first()
    )

    if credential:
        try:
            cipher = get_secret_cipher()
        except SecretEncryptionKeyError as exc:
            raise GeminiConfigurationError(str(exc)) from exc

        try:
            secret = cipher.decrypt(credential.encrypted_secret)
        except Exception as exc:  # pragma: no cover - defensive path
            logger.exception("Failed to decrypt API credential for provider 'gemini'")
            raise GeminiConfigurationError("Failed to decrypt Gemini API key.") from exc

        if not secret:
            raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

        model_name = credential.model or settings.gemini_model
        return secret, model_name

    disabled_exists = (
        db.query(models.ApiCredential)
        .filter(
            models.ApiCredential.provider == "gemini",
            models.ApiCredential.is_active.is_(False),
        )
        .first()
        is not None
    )
    if disabled_exists:
        raise GeminiConfigurationError("Gemini API key is disabled. Update it from the admin settings.")

    if settings.gemini_api_key:
        return settings.gemini_api_key, settings.gemini_model

    raise GeminiConfigurationError(
        "Gemini API key is not configured. Update it from the admin settings.",
        allow_fallback=True,
    )


def _load_active_provider_configuration(db: Session) -> tuple[str, str, str]:
    try:
        secret, model_name = _load_gemini_configuration(db)
        return "gemini", secret, model_name
    except GeminiConfigurationError as exc:
        if not getattr(exc, "allow_fallback", False):
            raise
        fallback_error = exc

    try:
        secret, model_name = _load_chatgpt_configuration(db, provider="openai")
    except ChatGPTConfigurationError as exc:
        message = str(exc)
        if "not configured" in message.lower():
            raise fallback_error from exc
        raise GeminiConfigurationError(message) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise GeminiConfigurationError("Failed to load OpenAI credentials.") from exc

    return "openai", secret, model_name


def get_gemini_client(db: Session = Depends(get_db)) -> GeminiClient:
    try:
        provider, api_key, model_name = _load_active_provider_configuration(db)
        if provider == "openai":
            return ChatGPTClient(api_key=api_key, model=model_name)
        return GeminiClient(api_key=api_key, model=model_name)
    except (GeminiConfigurationError, ChatGPTConfigurationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def get_optional_gemini_client(db: Session = Depends(get_db)) -> GeminiClient | None:
    try:
        return get_gemini_client(db)
    except HTTPException:
        return None


__all__ = [
    "GeminiClient",
    "GeminiConfigurationError",
    "GeminiError",
    "get_gemini_client",
    "get_optional_gemini_client",
]
