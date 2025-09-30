from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any, ClassVar, List, Optional, Sequence

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

try:  # pragma: no cover - optional dependency wrapper
    import google.generativeai as genai
    from google.api_core.exceptions import GoogleAPIError
except ModuleNotFoundError:  # pragma: no cover - executed when SDK missing
    genai = None  # type: ignore[misc, assignment]

    class GoogleAPIError(Exception):
        """Fallback error raised when the Gemini SDK is unavailable."""


from .. import models
from ..config import settings
from ..database import get_db
from ..schemas import (
    AnalysisCard,
    AnalysisRequest,
    AnalysisResponse,
    AnalysisSubtask,
    UserProfile,
)
from ..utils.secrets import SecretEncryptionKeyError, get_secret_cipher

logger = logging.getLogger(__name__)


class GeminiError(RuntimeError):
    """Base exception for Gemini integration errors."""


class GeminiConfigurationError(GeminiError):
    """Raised when required configuration for Gemini is missing."""


class GeminiClient:
    """Gemini client that transforms notes into structured proposals."""

    _BASE_RESPONSE_SCHEMA: ClassVar[dict[str, Any]] = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "model": {"type": "string"},
            "proposals": {
                "type": "array",
                "minItems": 0,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["title", "summary"],
                    "properties": {
                        "title": {"type": "string", "minLength": 1},
                        "summary": {"type": "string", "minLength": 1},
                        "status": {"type": "string", "default": "todo"},
                        "labels": {
                            "type": "array",
                            "default": [],
                            "items": {"type": "string"},
                        },
                        "priority": {"type": "string", "default": "medium"},
                        "due_in_days": {
                            "type": "integer",
                        },
                        "subtasks": {
                            "type": "array",
                            "default": [],
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["title"],
                                "properties": {
                                    "title": {
                                        "type": "string",
                                        "minLength": 1,
                                    },
                                    "description": {
                                        "type": "string",
                                    },
                                    "status": {
                                        "type": "string",
                                        "default": "todo",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "required": ["proposals"],
    }

    _SYSTEM_PROMPT: ClassVar[str] = (
        "You are Verbalize Yourself's analysis assistant."
        " Extract actionable work items from free-form product notes and respond"
        " using the requested JSON schema. Each proposal must contain a concise"
        " title, a summary that elaborates on the goal, optional labels,"
        " priority, due date guidance in days, and subtasks that describe"
        " concrete, verifiable actions. Each subtask must be a single step that"
        " starts with a strong verb, specifies the expected outcome, and avoids"
        " vague phrases. Use the same language as the user whenever possible."
        " When available, tailor goals and subtasks to the engineer profile"
        " metadata provided in the request."
    )

    _APPEAL_SYSTEM_PROMPT: ClassVar[str] = (
        "You are Verbalize Yourself's narrative assistant."
        " Craft compelling yet factual Japanese appeal narratives that emphasise"
        " causal relationships between challenges, actions, and results."
        " Always incorporate the required connective phrases naturally, avoid"
        " fabrication, and mirror the formal tone used by professionals."
        " Respond strictly using the provided JSON schema."
    )

    _UNSUPPORTED_SCHEMA_KEYS: ClassVar[set[str]] = {"additionalProperties", "minItems", "maxItems"}

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.model = model or settings.gemini_model
        self.api_key = api_key

        if not self.api_key:
            raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

        if genai is None:
            raise GeminiConfigurationError(
                "Gemini SDK is not installed. Install the 'google-generativeai' package to enable analysis."
            )

        genai.configure(api_key=self.api_key)
        self._client = genai.GenerativeModel(self.model)

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
        except GoogleAPIError as exc:
            logger.exception("Gemini request failed")
            raise GeminiError("Gemini request failed.") from exc
        except json.JSONDecodeError as exc:
            logger.exception("Unable to decode Gemini response")
            raise GeminiError("Gemini returned an invalid response.") from exc

        raw_proposals = payload.get("proposals", [])
        if not isinstance(raw_proposals, Sequence) or isinstance(raw_proposals, (str, bytes)):
            raw_proposals = []

        proposals = [card for card in (self._parse_card(item, text) for item in raw_proposals) if card is not None]

        if not proposals:
            proposals.append(self._fallback_card(text))

        model_name = payload.get("model") if isinstance(payload, dict) else None
        return AnalysisResponse(model=model_name or self.model, proposals=proposals[: request.max_cards])

    def generate_appeal(
        self,
        *,
        prompt: str,
        response_schema: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke the Gemini API to craft appeal narratives."""

        if not prompt.strip():
            raise GeminiError("Prompt for appeal generation must not be empty.")

        sanitized_schema = self._sanitize_schema(response_schema)
        generation_config = self._build_generation_config(sanitized_schema)
        combined_prompt = f"{self._APPEAL_SYSTEM_PROMPT}\n\n{prompt}"

        try:
            response = self._client.generate_content(
                combined_prompt,
                generation_config=generation_config,
            )
        except GoogleAPIError as exc:
            logger.exception("Gemini appeal generation failed")
            raise GeminiError("Gemini request failed.") from exc

        content = self._extract_content(response)
        data = self._parse_json_payload(content)
        if not isinstance(data, dict):
            raise GeminiError("Gemini response must be a JSON object.")

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
        user_prompt = self._build_user_prompt(text, max_cards, user_profile)
        generation_config = self._build_generation_config(response_format["json_schema"]["schema"])
        combined_prompt = f"{self._SYSTEM_PROMPT}\n\n{user_prompt}"

        response = self._client.generate_content(
            combined_prompt,
            generation_config=generation_config,
        )

        content = self._extract_content(response)
        data = self._parse_json_payload(content)
        if not isinstance(data, dict):
            raise GeminiError("Gemini response must be a JSON object.")
        if (not data.get("model")) and getattr(response, "model", None):
            enriched = dict(data)
            enriched["model"] = response.model
            return enriched
        return data

    def _build_response_format(self, max_cards: int) -> dict[str, Any]:
        schema = deepcopy(self._BASE_RESPONSE_SCHEMA)
        proposals_schema = schema["properties"]["proposals"]
        proposals_schema["maxItems"] = max_cards
        sanitized_schema = self._sanitize_schema(schema)
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "analysis_response",
                "strict": True,
                "schema": sanitized_schema,
            },
        }

    def _build_generation_config(self, schema: dict[str, Any]) -> Any:
        sanitized_schema = self._sanitize_schema(schema)
        config: dict[str, Any] = {
            "response_mime_type": "application/json",
            "response_schema": sanitized_schema,
        }
        generation_config_cls = getattr(getattr(genai, "types", None), "GenerationConfig", None)
        if generation_config_cls is not None:
            try:
                return generation_config_cls(**config)
            except Exception:  # pragma: no cover - fall back to dict
                logger.debug("Falling back to dict generation config", exc_info=True)
        return config

    @classmethod
    def _sanitize_schema(cls, schema: dict[str, Any]) -> dict[str, Any]:
        """Return a deep-copied schema without unsupported Gemini keys."""

        def _sanitize(value: Any) -> Any:
            if isinstance(value, dict):
                return {
                    key: _sanitize(inner) for key, inner in value.items() if key not in cls._UNSUPPORTED_SCHEMA_KEYS
                }
            if isinstance(value, list):
                return [_sanitize(item) for item in value]
            if isinstance(value, tuple):
                return tuple(_sanitize(item) for item in value)
            return value

        return _sanitize(deepcopy(schema))

    def _build_user_prompt(
        self,
        text: str,
        max_cards: int,
        user_profile: UserProfile | None = None,
    ) -> str:
        guidance = (
            "Analyse the following notes and propose at most {max_cards} actionable cards. "
            "Summaries should be outcome focused. Provide due_in_days only when the text "
            "contains explicit or strongly implied timing. When unsure, omit optional fields."
        )
        sections = [guidance.format(max_cards=max_cards)]
        profile_metadata = self._build_profile_metadata(user_profile)
        if profile_metadata:
            sections.append("Engineer profile:\n" + profile_metadata)
        sections.append("Notes:\n" + text)
        return "\n\n".join(sections)

    def _extract_usage(self, response: Any) -> dict[str, int]:
        usage = getattr(response, "usage", None) or getattr(response, "usage_metadata", None)
        if not usage:
            return {}

        def _value(source: Any, key: str) -> Any:
            if isinstance(source, dict):
                return source.get(key)
            return getattr(source, key, None)

        result: dict[str, int] = {}
        key_mapping = {
            "prompt_tokens": ("prompt_tokens", "input_tokens"),
            "completion_tokens": ("completion_tokens", "output_tokens"),
            "total_tokens": ("total_tokens", "total_tokens"),
        }
        for target, aliases in key_mapping.items():
            value = None
            for alias in aliases:
                value = _value(usage, alias)
                if value is not None:
                    break
            if value is None and hasattr(usage, "get"):
                for alias in aliases:
                    value = usage.get(alias)
                    if value is not None:
                        break
            if value is None and hasattr(usage, "to_dict"):
                try:
                    data = usage.to_dict()  # type: ignore[call-arg]
                except Exception:  # pragma: no cover - defensive
                    data = None
                if isinstance(data, dict):
                    for alias in aliases:
                        if alias in data:
                            value = data[alias]
                            break
            if value is None:
                continue
            try:
                result[target] = int(value)
            except (TypeError, ValueError):
                continue
        return result

    def _build_profile_metadata(self, profile: UserProfile | None) -> str:
        if profile is None:
            return ""

        metadata: dict[str, Any] = {
            "user_id": profile.id,
            "email": profile.email,
            "display_name": profile.nickname or profile.email,
        }

        if profile.experience_years is not None:
            metadata["experience_years"] = profile.experience_years
        if profile.roles:
            metadata["roles"] = profile.roles
        if profile.bio:
            metadata["bio"] = profile.bio

        if getattr(profile, "updated_at", None):
            metadata["profile_last_updated"] = profile.updated_at.isoformat()

        return json.dumps(metadata, ensure_ascii=False, indent=2)

    def _extract_content(self, response: Any) -> str:
        text_value = getattr(response, "text", None)
        if isinstance(text_value, str) and text_value.strip():
            return text_value

        if getattr(response, "candidates", None):
            fragments: List[str] = []
            for candidate in response.candidates:  # type: ignore[attr-defined]
                content = getattr(candidate, "content", None)
                parts = getattr(candidate, "parts", None)
                iterable = content if isinstance(content, Sequence) else parts
                if not iterable:
                    continue
                for part in iterable:
                    text = getattr(part, "text", None) or getattr(part, "value", None)
                    if isinstance(text, str):
                        fragments.append(text)
            if fragments:
                return "".join(fragments)

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

        raise GeminiError("Gemini response did not contain any text output.")

    def _parse_json_payload(self, content: str) -> Any:
        """Decode Gemini output into Python objects.

        Gemini should honour the supplied JSON schema, but responses may still
        wrap valid payloads in fenced code blocks. Try a best-effort cleanup
        before bubbling the decoding error to the caller.
        """

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            cleaned = self._strip_code_fences(content)
            if cleaned == content:
                raise
            return json.loads(cleaned)

    def _strip_code_fences(self, text: str) -> str:
        """Remove Markdown-style code fences from a JSON string."""

        stripped = text.strip()
        if not (stripped.startswith("```") and stripped.endswith("```")):
            return stripped

        inner = stripped[3:-3].strip()
        if "\n" in inner:
            first_line, rest = inner.split("\n", 1)
            marker = first_line.strip().lower()
            if marker in {"", "json", "jsonc", "javascript"}:
                return rest.strip()
        return inner

    def _parse_card(self, data: Any, original_text: str) -> Optional[AnalysisCard]:
        if not isinstance(data, dict):
            logger.warning("Skipping non-object card proposal: %r", data)
            return None

        title = self._clean_string(data.get("title")) or "Untitled proposal"
        summary = self._clean_string(data.get("summary")) or original_text[:500]
        status = self._clean_string(data.get("status")) or "todo"
        priority = self._clean_string(data.get("priority")) or "medium"
        labels = self._string_list(data.get("labels"))
        due_in_days = self._to_optional_int(data.get("due_in_days"))
        raw_subtasks = data.get("subtasks", [])
        if not isinstance(raw_subtasks, Sequence) or isinstance(raw_subtasks, (str, bytes)):
            raw_subtasks = []

        subtasks = [subtask for subtask in (self._parse_subtask(item) for item in raw_subtasks) if subtask is not None]

        return AnalysisCard(
            title=title,
            summary=summary,
            status=status,
            labels=labels,
            priority=priority,
            due_in_days=due_in_days,
            subtasks=subtasks,
        )

    def _parse_subtask(self, data: Any) -> Optional[AnalysisSubtask]:
        if not isinstance(data, dict):
            logger.warning("Skipping non-object subtask proposal: %r", data)
            return None

        title = self._clean_string(data.get("title"))
        if not title:
            return None

        description = self._clean_string(data.get("description"))
        status = self._clean_string(data.get("status")) or "todo"

        return AnalysisSubtask(title=title, description=description, status=status)

    def _fallback_card(self, text: str) -> AnalysisCard:
        snippet = " ".join(part.strip() for part in text.splitlines() if part.strip())
        title = snippet[:80] or "Generated task"
        summary = text[:500] or title
        return AnalysisCard(title=title, summary=summary)

    def _string_list(self, value: Any) -> List[str]:
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
            results: List[str] = []
            for item in value:
                text = self._clean_string(item)
                if text:
                    results.append(text)
            return results
        return []

    def _to_optional_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _clean_string(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None


def _load_gemini_configuration(db: Session, provider: str = "gemini") -> tuple[str, str]:
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
            raise GeminiConfigurationError("Gemini API key is disabled. Update it from the admin settings.")

        if settings.gemini_api_key:
            return settings.gemini_api_key, settings.gemini_model

        raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

    try:
        cipher = get_secret_cipher()
    except SecretEncryptionKeyError as exc:
        raise GeminiConfigurationError(str(exc)) from exc
    try:
        decryption = cipher.decrypt(credential.encrypted_secret)
        secret = decryption.plaintext
    except Exception as exc:  # pragma: no cover - defensive path
        logger.exception("Failed to decrypt API credential for provider '%s'", provider)
        raise GeminiConfigurationError("Failed to decrypt Gemini API key.") from exc

    if decryption.reencrypted_payload:
        credential.encrypted_secret = decryption.reencrypted_payload
        db.add(credential)
        db.commit()
        db.refresh(credential)

    if not secret:
        raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

    model = credential.model or settings.gemini_model
    return secret, model


def _load_gemini_api_key(db: Session, provider: str = "gemini") -> str:
    secret, _ = _load_gemini_configuration(db, provider)
    return secret


def get_gemini_client(db: Session = Depends(get_db)) -> GeminiClient:
    try:
        api_key, model = _load_gemini_configuration(db)
        return GeminiClient(api_key=api_key, model=model)
    except GeminiConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def get_optional_gemini_client(db: Session = Depends(get_db)) -> GeminiClient | None:
    try:
        return get_gemini_client(db)
    except HTTPException:
        return None
