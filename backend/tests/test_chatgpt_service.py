from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.schemas import UserProfile
from app.services.chatgpt import ChatGPTClient, ChatGPTError


def _make_client() -> ChatGPTClient:
    client = object.__new__(ChatGPTClient)
    client.model = "test-model"
    return client  # type: ignore[return-value]


def test_build_response_format_sets_strict_and_max_items() -> None:
    client = _make_client()

    result = ChatGPTClient._build_response_format(client, 4)

    assert result["type"] == "json_schema"
    json_schema = result["json_schema"]
    assert json_schema["name"] == "analysis_response"
    assert json_schema["strict"] is True
    assert json_schema["schema"]["properties"]["proposals"]["maxItems"] == 4


def test_build_response_format_is_idempotent() -> None:
    client = _make_client()

    first = ChatGPTClient._build_response_format(client, 1)
    second = ChatGPTClient._build_response_format(client, 6)

    assert first["json_schema"]["schema"]["properties"]["proposals"]["maxItems"] == 1
    assert second["json_schema"]["schema"]["properties"]["proposals"]["maxItems"] == 6


def test_extract_content_reads_text_values() -> None:
    client = _make_client()
    response = SimpleNamespace(
        output=[SimpleNamespace(content=[SimpleNamespace(text=SimpleNamespace(value='{"ok": true}'))])]
    )

    content = ChatGPTClient._extract_content(client, response)

    assert content == '{"ok": true}'


def test_extract_content_requires_text() -> None:
    client = _make_client()
    response = SimpleNamespace(output=[])

    with pytest.raises(ChatGPTError):
        ChatGPTClient._extract_content(client, response)


def test_parse_json_payload_strips_code_fences() -> None:
    client = _make_client()
    payload = '```json\n{"proposals": []}\n```'

    parsed = ChatGPTClient._parse_json_payload(client, payload)

    assert parsed == {"proposals": []}


def test_parse_json_payload_raises_for_invalid_json() -> None:
    client = _make_client()

    with pytest.raises(json.JSONDecodeError):
        ChatGPTClient._parse_json_payload(client, "not-json")


def test_request_analysis_enriches_model_from_response() -> None:
    client = _make_client()

    recorded: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        recorded.update(kwargs)
        return SimpleNamespace(
            model="gpt-test",
            output=[SimpleNamespace(content=[SimpleNamespace(text='{"proposals": []}')])],
        )

    client._client = SimpleNamespace(responses=SimpleNamespace(create=fake_create))  # type: ignore[attr-defined]

    data = ChatGPTClient._request_analysis(client, "Analyse Notes", 2)

    assert data == {"model": "gpt-test", "proposals": []}
    assert recorded["instructions"] == ChatGPTClient._SYSTEM_PROMPT
    assert "Analyse Notes" in recorded["input"]


def test_build_user_prompt_includes_profile_metadata() -> None:
    client = _make_client()
    now = datetime.now(timezone.utc)
    profile = UserProfile(
        id="user-123",
        email="dev@example.com",
        is_admin=False,
        created_at=now,
        updated_at=now,
        nickname="Dev",
        experience_years=6,
        roles=["backend", "ml"],
        bio="Builds resilient APIs.",
    )

    prompt = ChatGPTClient._build_user_prompt(
        client,
        "Investigate login failures",
        3,
        profile,
    )

    assert "Engineer profile:" in prompt
    assert '"experience_years": 6' in prompt
    assert "backend" in prompt
    assert "Investigate login failures" in prompt
