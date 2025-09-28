"""Shared helpers for structured LLM integrations."""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any, Optional, Sequence

from ..schemas import AnalysisCard, AnalysisSubtask, AnalysisRequest, UserProfile

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Base exception for structured language model errors."""


class LLMConfigurationError(LLMError):
    """Raised when an integration is missing required configuration."""


BASE_RESPONSE_SCHEMA: dict[str, Any] = {
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


SYSTEM_PROMPT = (
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


APPEAL_SYSTEM_PROMPT = (
    "You are Verbalize Yourself's narrative assistant."
    " Craft compelling yet factual Japanese appeal narratives that emphasise"
    " causal relationships between challenges, actions, and results."
    " Always incorporate the required connective phrases naturally, avoid"
    " fabrication, and mirror the formal tone used by professionals."
    " Respond strictly using the provided JSON schema."
)


def build_analysis_schema(max_cards: int) -> dict[str, Any]:
    """Return a strict JSON schema describing the analysis response."""

    schema = deepcopy(BASE_RESPONSE_SCHEMA)
    schema["properties"]["proposals"]["maxItems"] = max_cards
    return schema


def build_user_prompt(text: str, max_cards: int, user_profile: UserProfile | None = None) -> str:
    """Compose the user-facing prompt for analysis calls."""

    guidance = (
        "Analyse the following notes and propose at most {max_cards} actionable cards. "
        "Summaries should be outcome focused. Provide due_in_days only when the text "
        "contains explicit or strongly implied timing. When unsure, omit optional fields."
    )
    sections = [guidance.format(max_cards=max_cards)]
    profile_metadata = build_profile_metadata(user_profile)
    if profile_metadata:
        sections.append("Engineer profile:\n" + profile_metadata)
    sections.append("Notes:\n" + text)
    return "\n\n".join(sections)


def build_profile_metadata(profile: UserProfile | None) -> str:
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


def parse_json_payload(content: str) -> Any:
    """Decode a JSON payload, trimming code fences when present."""

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        cleaned = strip_code_fences(content)
        if cleaned == content:
            raise
        return json.loads(cleaned)


def strip_code_fences(text: str) -> str:
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


def parse_card(data: Any, original_text: str) -> AnalysisCard | None:
    if not isinstance(data, dict):
        logger.warning("Skipping non-object card proposal: %r", data)
        return None

    title = clean_string(data.get("title")) or "Untitled proposal"
    summary = clean_string(data.get("summary")) or original_text[:500]
    status = clean_string(data.get("status")) or "todo"
    priority = clean_string(data.get("priority")) or "medium"
    labels = string_list(data.get("labels"))
    due_in_days = to_optional_int(data.get("due_in_days"))
    raw_subtasks = data.get("subtasks", [])
    if not isinstance(raw_subtasks, Sequence) or isinstance(raw_subtasks, (str, bytes)):
        raw_subtasks = []

    subtasks = [subtask for subtask in (parse_subtask(item) for item in raw_subtasks) if subtask is not None]

    return AnalysisCard(
        title=title,
        summary=summary,
        status=status,
        labels=labels,
        priority=priority,
        due_in_days=due_in_days,
        subtasks=subtasks,
    )


def parse_subtask(data: Any) -> AnalysisSubtask | None:
    if not isinstance(data, dict):
        logger.warning("Skipping non-object subtask proposal: %r", data)
        return None

    title = clean_string(data.get("title"))
    if not title:
        return None

    description = clean_string(data.get("description"))
    status = clean_string(data.get("status")) or "todo"

    return AnalysisSubtask(title=title, description=description, status=status)


def fallback_card(text: str) -> AnalysisCard:
    snippet = " ".join(part.strip() for part in text.splitlines() if part.strip())
    title = snippet[:80] or "Generated task"
    summary = text[:500] or title
    return AnalysisCard(title=title, summary=summary)


def string_list(value: Any) -> list[str]:
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        items = [clean_string(item) for item in value]
        return [item for item in items if item]
    return []


def to_optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def clean_string(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text


__all__ = [
    "APPEAL_SYSTEM_PROMPT",
    "BASE_RESPONSE_SCHEMA",
    "LLMConfigurationError",
    "LLMError",
    "SYSTEM_PROMPT",
    "build_analysis_schema",
    "build_profile_metadata",
    "build_user_prompt",
    "clean_string",
    "fallback_card",
    "parse_card",
    "parse_json_payload",
    "parse_subtask",
    "string_list",
    "strip_code_fences",
    "to_optional_int",
]
