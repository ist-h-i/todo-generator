from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any, ClassVar, List, Optional, Sequence

from fastapi import HTTPException, status

try:  # pragma: no cover - optional dependency wrapper
    from openai import OpenAI, OpenAIError
except ModuleNotFoundError:  # pragma: no cover - executed when SDK missing
    OpenAI = None  # type: ignore[misc, assignment]

    class OpenAIError(Exception):
        """Fallback error raised when the OpenAI SDK is unavailable."""


from ..config import settings
from ..schemas import (
    AnalysisCard,
    AnalysisRequest,
    AnalysisResponse,
    AnalysisSubtask,
    UserProfile,
)

logger = logging.getLogger(__name__)


class ChatGPTError(RuntimeError):
    """Base exception for ChatGPT integration errors."""


class ChatGPTConfigurationError(ChatGPTError):
    """Raised when required configuration for ChatGPT is missing."""


class ChatGPTClient:
    """Real ChatGPT client that transforms notes into structured proposals."""

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
                            "type": ["integer", "null"],
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
                                        "type": ["string", "null"],
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
        "You are Todo Generator's analysis assistant."
        " Extract actionable work items from free-form product notes and respond"
        " using the requested JSON schema. Each proposal must contain a concise"
        " title, a summary that elaborates on the goal, optional labels,"
        " priority, due date guidance in days, and subtasks that describe"
        " concrete steps. Use the same language as the user whenever possible."
        " When available, tailor goals and subtasks to the engineer profile"
        " metadata provided in the request."
    )

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.model = model or settings.chatgpt_model
        self.api_key = api_key or settings.chatgpt_api_key

        if not self.api_key:
            raise ChatGPTConfigurationError(
                "ChatGPT API key is not configured. Set OPENAI_API_KEY environment variable."
            )

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

        proposals = [card for card in (self._parse_card(item, text) for item in raw_proposals) if card is not None]

        if not proposals:
            proposals.append(self._fallback_card(text))

        model_name = payload.get("model") if isinstance(payload, dict) else None
        return AnalysisResponse(model=model_name or self.model, proposals=proposals[: request.max_cards])

    def _request_analysis(
        self,
        text: str,
        max_cards: int,
        user_profile: UserProfile | None = None,
    ) -> dict[str, Any]:
        response_format = self._build_response_format(max_cards)
        user_prompt = self._build_user_prompt(text, max_cards, user_profile)

        response = self._client.responses.create(
            model=self.model,
            instructions=self._SYSTEM_PROMPT,
            input=user_prompt,
            response_format=response_format,
        )

        content = self._extract_content(response)
        data = self._parse_json_payload(content)
        if not isinstance(data, dict):
            raise ChatGPTError("ChatGPT response must be a JSON object.")
        if (not data.get("model")) and getattr(response, "model", None):
            enriched = dict(data)
            enriched["model"] = response.model
            return enriched
        return data

    def _build_response_format(self, max_cards: int) -> dict[str, Any]:
        schema = deepcopy(self._BASE_RESPONSE_SCHEMA)
        proposals_schema = schema["properties"]["proposals"]
        proposals_schema["maxItems"] = max_cards
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "analysis_response",
                "strict": True,
                "schema": schema,
            },
        }

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

    def _parse_json_payload(self, content: str) -> Any:
        """Decode ChatGPT output into Python objects.

        The Responses API should honour the supplied JSON schema, but older
        models occasionally wrap valid payloads in fenced code blocks. Try a
        best-effort cleanup before bubbling the decoding error to the caller.
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
            items = [self._clean_string(item) for item in value]
            return [item for item in items if item]
        return []

    def _to_optional_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _clean_string(self, value: Any) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        return text


def get_chatgpt_client() -> ChatGPTClient:
    try:
        return ChatGPTClient()
    except ChatGPTConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
