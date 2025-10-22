from __future__ import annotations

import json
import logging
import re
from copy import deepcopy
from dataclasses import dataclass
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
from ..utils.crypto import SecretDecryptionError
from ..utils.secrets import SecretEncryptionKeyError, get_secret_cipher
from .status_defaults import ensure_default_statuses

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
        " title, a summary that elaborates on the goal, at least one label when"
        " label options are provided, priority, due date guidance in days, and"
        " subtasks that describe concrete, verifiable actions. Each subtask must"
        " be a single step that starts with a strong verb, specifies the expected"
        " outcome, and avoids vague phrases. Provide Japanese text for narrative"
        " fields such as titles, summaries, and descriptions while preserving"
        " categorical identifiers like status, priority, and label values in the"
        " schema's expected English. Translate user content when necessary so"
        " prose remains natural in Japanese."
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

    _SCHEMA_KEY_ALIASES: ClassVar[dict[str, str]] = {
        "maxItems": "max_items",
        "minItems": "min_items",
    }

    _UNSUPPORTED_SCHEMA_KEYS: ClassVar[set[str]] = {
        "additionalProperties",
        "default",
        "description",
        "examples",
        "patternProperties",
        "propertyNames",
        "minLength",
        "maxLength",
        "pattern",
        "format",
        "contentEncoding",
        "contentMediaType",
        "title",
        "$defs",
        "$id",
        "$schema",
        "$ref",
        "definitions",
        "deprecated",
        "readOnly",
        "writeOnly",
        "unevaluatedItems",
        "unevaluatedProperties",
        "contains",
        "const",
        "enum",
        "anyOf",
        "oneOf",
        "allOf",
        "not",
        "if",
        "then",
        "else",
        "dependentRequired",
        "dependentSchemas",
        "minContains",
        "maxContains",
        "maxProperties",
        "minProperties",
        "exclusiveMaximum",
        "exclusiveMinimum",
        "multipleOf",
        "uniqueItems",
    }

    _LEGACY_MODEL_ALIASES: ClassVar[dict[str, str]] = {
        "gemini-1.5-flash": "models/gemini-1.5-flash",
        "gemini-2.0-flash": "models/gemini-2.0-flash",
    }

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        resolved_model = model or settings.gemini_model
        self.model = self.normalize_model_name(resolved_model)
        self.api_key = api_key

        if not self.api_key:
            raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

        if genai is None:
            raise GeminiConfigurationError(
                "Gemini SDK is not installed. Install the 'google-generativeai' package to enable analysis."
            )

        genai.configure(api_key=self.api_key)
        self.model = self._ensure_supported_model(self.model)
        self._client = genai.GenerativeModel(self.model)

    def _ensure_supported_model(self, model: str) -> str:
        """Return a model that is supported by the configured Gemini account."""

        list_models = getattr(genai, "list_models", None)
        if not callable(list_models):
            return model

        try:
            catalog = list(list_models())
        except Exception:  # pragma: no cover - defensive fallback when discovery fails
            logger.debug("Unable to list Gemini models; continuing with configured model.", exc_info=True)
            return model

        supported_names = self._supported_generate_content_models(catalog)
        if not supported_names:
            return model
        if model in supported_names:
            return model

        fallback = self._find_preferred_variant(model, supported_names)
        if fallback:
            if fallback != model:
                logger.info("Resolved Gemini model '%s' to available variant '%s'.", model, fallback)
            return fallback

        preview = ", ".join(sorted(supported_names)[:5])
        if len(supported_names) > 5:
            preview += ", …"
        raise GeminiConfigurationError(
            (
                f"Gemini model '{model}' is not available for generateContent. "
                "Update the admin settings to use one of the supported models, such as: "
                f"{preview}."
            )
        )

    @classmethod
    def _supported_generate_content_models(cls, catalog: Sequence[Any]) -> list[str]:
        """Extract model names that support the generateContent method."""

        supported: list[str] = []
        for item in catalog:
            name = getattr(item, "name", None)
            if not name or not isinstance(name, str):
                continue

            methods = getattr(item, "supported_generation_methods", ()) or ()
            if isinstance(methods, str):
                method_list = [methods]
            elif isinstance(methods, Sequence):
                method_list = list(methods)
            else:
                method_list = []

            if "generateContent" not in method_list:
                continue

            supported.append(name)

        return supported

    @classmethod
    def _find_preferred_variant(cls, requested: str, available: Sequence[str]) -> str | None:
        """Return the closest matching model variant from the available catalog."""

        if not available:
            return None

        family = cls._canonical_model_family(requested)
        if not family:
            return None

        candidates = [name for name in available if cls._canonical_model_family(name) == family]
        if not candidates:
            return None

        latest = [name for name in candidates if name.split("/")[-1].endswith("-latest")]
        if latest:
            return sorted(latest)[-1]

        numbered: list[tuple[int, str]] = []
        others: list[str] = []
        for name in candidates:
            suffix = name.split("/")[-1]
            match = re.search(r"-(\d+)$", suffix)
            if match:
                numbered.append((int(match.group(1)), name))
            else:
                others.append(name)

        if numbered:
            return max(numbered)[1]
        return sorted(others)[-1] if others else None

    @staticmethod
    def _canonical_model_family(name: str) -> str:
        """Strip version suffixes so related model variants can be grouped."""

        base = name.split("/")[-1]
        return re.sub(r"-(?:latest|\d+)$", "", base)

    @classmethod
    def normalize_model_name(cls, model: str) -> str:
        """Return a supported Gemini model name."""

        normalized = model.strip()
        if not normalized:
            return normalized
        mapped = cls._LEGACY_MODEL_ALIASES.get(normalized)
        if mapped:
            return mapped
        if normalized.startswith("models/"):
            return normalized
        if normalized.startswith("gemini-1.5-flash"):
            return f"models/{normalized}"
        if normalized.startswith("gemini-2.0-flash"):
            return f"models/{normalized}"
        return normalized

    def analyze(
        self,
        request: AnalysisRequest,
        *,
        user_profile: UserProfile | None = None,
        workspace_options: AnalysisWorkspaceOptions | None = None,
    ) -> AnalysisResponse:
        text = request.text.strip()
        if not text:
            return AnalysisResponse(model=self.model, proposals=[])

        try:
            payload = self._request_analysis(
                text,
                request.max_cards,
                user_profile,
                workspace_options,
            )
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
        workspace_options: AnalysisWorkspaceOptions | None = None,
    ) -> dict[str, Any]:
        response_format = self._build_response_format(max_cards)
        user_prompt = self._build_user_prompt(
            text,
            max_cards,
            user_profile,
            workspace_options,
        )
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

        def _sanitize(value: Any, parent_key: str | None = None) -> Any:
            if isinstance(value, dict):
                sanitized: dict[str, Any] = {}
                for key, inner in value.items():
                    if parent_key == "properties":
                        sanitized[key] = _sanitize(inner, None)
                        continue

                    mapped_key = cls._SCHEMA_KEY_ALIASES.get(key, key)
                    if mapped_key in cls._UNSUPPORTED_SCHEMA_KEYS:
                        continue
                    sanitized[mapped_key] = _sanitize(inner, mapped_key)
                return sanitized
            if isinstance(value, list):
                return [_sanitize(item, parent_key) for item in value]
            if isinstance(value, tuple):
                return tuple(_sanitize(item, parent_key) for item in value)
            return value

        return _sanitize(deepcopy(schema))

    def _build_user_prompt(
        self,
        text: str,
        max_cards: int,
        user_profile: UserProfile | None = None,
        workspace_options: AnalysisWorkspaceOptions | None = None,
    ) -> str:
        guidance = (
            "Analyse the following notes and propose at most {max_cards} actionable cards. "
            "Summaries should be outcome focused. Provide due_in_days only when the text "
            "contains explicit or strongly implied timing. When unsure, omit optional fields."
        )
        sections = [guidance.format(max_cards=max_cards)]
        workspace_guidance = self._compose_workspace_guidance(workspace_options)
        if workspace_guidance:
            sections.append(workspace_guidance)
        profile_metadata = self._build_profile_metadata(user_profile)
        if profile_metadata:
            sections.append("Engineer profile:\n" + profile_metadata)
        sections.append("Notes:\n" + text)
        return "\n\n".join(sections)

    def _compose_workspace_guidance(
        self,
        options: AnalysisWorkspaceOptions | None,
    ) -> str | None:
        if not options:
            return None

        segments: list[str] = []

        if options.statuses:
            lines: list[str] = [
                "Available statuses (return the id or name that best matches the proposal):",
            ]
            for status in options.statuses:
                parts = [f"- {status.name} (id: {status.id}"]
                if status.category:
                    parts.append(f", category: {status.category}")
                parts.append(")")
                lines.append("".join(parts))

            if options.default_status_id:
                default_status = next(
                    (status for status in options.statuses if status.id == options.default_status_id),
                    None,
                )
                if default_status:
                    lines.append(
                        "When uncertain, default to status "
                        f"'{default_status.name}' (id: {default_status.id}).",
                    )

            segments.append("\n".join(lines))

        if options.labels:
            label_lines = ["Available labels registered by the current user:"]
            for label in options.labels:
                label_lines.append(f"- {label.name} (id: {label.id})")

            preferred_lookup = set(options.preferred_label_ids)
            preferred_labels = [
                label for label in options.labels if label.id in preferred_lookup
            ]
            if preferred_labels:
                if len(preferred_labels) == 1:
                    label = preferred_labels[0]
                    label_lines.append(
                        "When you need a general-purpose label, prefer "
                        f"'{label.name}' (id: {label.id}).",
                    )
                else:
                    suggestions = ", ".join(
                        f"'{label.name}' (id: {label.id})" for label in preferred_labels
                    )
                    label_lines.append(
                        "When you need a general-purpose label, prefer " + suggestions + ".",
                    )

            label_lines.append(
                "Always choose at least one label when proposing work. When a"
                " listed label applies, return its id exactly as written."
            )
            label_lines.append(
                "If none of the available labels fit, create a new concise label"
                " name instead of leaving the list empty."
            )

            segments.append("\n".join(label_lines))

        if not segments:
            return None

        return "\n\n".join(segments)

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
            return settings.gemini_api_key, GeminiClient.normalize_model_name(settings.gemini_model)

        raise GeminiConfigurationError("Gemini API key is not configured. Update it from the admin settings.")

    try:
        cipher = get_secret_cipher()
    except SecretEncryptionKeyError as exc:
        raise GeminiConfigurationError(str(exc)) from exc
    try:
        decryption = cipher.decrypt(credential.encrypted_secret)
        secret = decryption.plaintext
    except SecretDecryptionError as exc:
        logger.exception("Failed to decrypt API credential for provider '%s'", provider)
        raise GeminiConfigurationError(
            "Gemini API key could not be decrypted. Update it from the admin settings."
        ) from exc
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
    normalized_model = GeminiClient.normalize_model_name(model)
    if credential.model and credential.model != normalized_model:
        credential.model = normalized_model
        db.add(credential)
        db.commit()
        db.refresh(credential)
    return secret, normalized_model


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
@dataclass(frozen=True)
class AnalysisWorkspaceStatusOption:
    """Serializable representation of a workspace status for prompt guidance."""

    id: str
    name: str
    category: str | None = None


@dataclass(frozen=True)
class AnalysisWorkspaceLabelOption:
    """Serializable representation of a workspace label for prompt guidance."""

    id: str
    name: str


@dataclass(frozen=True)
class AnalysisWorkspaceOptions:
    """Workspace metadata provided to Gemini when generating proposals."""

    statuses: tuple[AnalysisWorkspaceStatusOption, ...] = ()
    labels: tuple[AnalysisWorkspaceLabelOption, ...] = ()
    default_status_id: str | None = None
    preferred_label_ids: tuple[str, ...] = ()


def _status_sort_key(status: models.Status) -> tuple[int, str]:
    order = status.order if status.order is not None else 0
    name = status.name or ""
    return (order, name.casefold())


def _select_default_status(statuses: Sequence[models.Status]) -> models.Status | None:
    for candidate in statuses:
        category = (candidate.category or "").strip().casefold()
        if category == "todo":
            return candidate

    for candidate in statuses:
        name = (candidate.name or "").strip().casefold()
        if name in {"todo", "to do"}:
            return candidate

    return statuses[0] if statuses else None


def build_workspace_analysis_options(db: Session, *, owner_id: str) -> AnalysisWorkspaceOptions:
    """Collect statuses and labels for analyzer prompts."""

    statuses, _ = ensure_default_statuses(db, owner_id=owner_id)
    ordered_statuses = sorted(statuses, key=_status_sort_key)
    labels = (
        db.query(models.Label)
        .filter(models.Label.owner_id == owner_id)
        .order_by(models.Label.name)
        .all()
    )

    default_status = _select_default_status(ordered_statuses)
    preferred_label_ids = tuple(
        label.id
        for label in labels
        if (label.name or "").strip().casefold() == "ai"
    )

    return AnalysisWorkspaceOptions(
        statuses=tuple(
            AnalysisWorkspaceStatusOption(
                id=status.id,
                name=status.name,
                category=status.category,
            )
            for status in ordered_statuses
        ),
        labels=tuple(
            AnalysisWorkspaceLabelOption(
                id=label.id,
                name=label.name,
            )
            for label in labels
        ),
        default_status_id=default_status.id if default_status else None,
        preferred_label_ids=preferred_label_ids,
    )
