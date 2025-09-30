from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import models
from app.config import settings
from app.database import get_db
from app.schemas import UserProfile
from app.services.gemini import (
    GeminiClient,
    GeminiConfigurationError,
    GeminiError,
    _load_gemini_configuration,
)
from app.utils.secrets import get_secret_cipher


def _make_client() -> GeminiClient:
    client = object.__new__(GeminiClient)
    client.model = "test-model"
    return client  # type: ignore[return-value]


def _contains_key(value: Any, target: str) -> bool:
    if isinstance(value, dict):
        return target in value or any(_contains_key(item, target) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(_contains_key(item, target) for item in value)
    return False


def _extract_response_schema(config: Any) -> dict[str, Any]:
    if isinstance(config, dict):
        return config["response_schema"]
    schema = getattr(config, "response_schema", None)
    if isinstance(schema, dict):
        return schema
    to_dict = getattr(config, "to_dict", None)
    if callable(to_dict):
        data = to_dict()
        if isinstance(data, dict) and "response_schema" in data:
            value = data["response_schema"]
            if isinstance(value, dict):
                return value
    raise AssertionError("Unable to extract response_schema from generation config")


def test_build_response_format_sets_strict_and_max_items() -> None:
    client = _make_client()

    result = GeminiClient._build_response_format(client, 4)

    assert result["type"] == "json_schema"
    json_schema = result["json_schema"]
    assert json_schema["name"] == "analysis_response"
    assert json_schema["strict"] is True
    proposals_schema = json_schema["schema"]["properties"]["proposals"]
    assert proposals_schema["max_items"] == 4
    assert "maxItems" not in proposals_schema


def test_build_response_format_removes_unsupported_keys() -> None:
    client = _make_client()

    schema = GeminiClient._build_response_format(client, 2)["json_schema"]["schema"]

    assert not _contains_key(schema, "maxItems")
    assert not _contains_key(schema, "default")
    assert not _contains_key(schema, "additionalProperties")


def test_build_response_format_is_idempotent() -> None:
    client = _make_client()

    first = GeminiClient._build_response_format(client, 1)
    second = GeminiClient._build_response_format(client, 6)

    first_schema = first["json_schema"]["schema"]["properties"]["proposals"]
    second_schema = second["json_schema"]["schema"]["properties"]["proposals"]

    assert "maxItems" not in first_schema
    assert "maxItems" not in second_schema
    assert first_schema["max_items"] == 1
    assert second_schema["max_items"] == 6


def test_sanitize_schema_removes_unsupported_keys() -> None:
    schema = {
        "type": "array",
        "maxItems": 5,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "values": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 3,
                    "items": {"type": "string", "minLength": 2, "default": ""},
                }
            },
        },
    }

    sanitized = GeminiClient._sanitize_schema(schema)

    assert "maxItems" in schema  # original schema should remain unchanged
    assert "maxItems" not in sanitized
    assert sanitized["max_items"] == 5
    values_schema = sanitized["items"]["properties"]["values"]
    assert values_schema["max_items"] == 3
    assert "minLength" not in values_schema["items"]
    assert "default" not in values_schema
    assert not _contains_key(sanitized, "minItems")
    assert not _contains_key(sanitized, "additionalProperties")
    assert sanitized["items"] is not schema["items"]


def test_sanitize_schema_preserves_property_definitions() -> None:
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "default": "n/a"},
            "description": {"type": "string", "minLength": 3},
        },
        "required": ["title"],
    }

    sanitized = GeminiClient._sanitize_schema(schema)

    assert set(sanitized["properties"].keys()) == {"title", "description"}
    assert sanitized["properties"]["title"] == {"type": "string"}
    assert sanitized["properties"]["description"] == {"type": "string"}


def test_build_generation_config_removes_unsupported_keys() -> None:
    client = _make_client()

    config = GeminiClient._build_generation_config(
        client,
        {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "maxItems": 4,
                    "items": {
                        "type": "integer",
                        "default": 1,
                        "pattern": "[0-9]+",
                    },
                }
            },
        },
    )

    schema = _extract_response_schema(config)

    assert not _contains_key(schema, "maxItems")
    assert schema["properties"]["items"]["max_items"] == 4
    assert not _contains_key(schema, "pattern")
    assert not _contains_key(schema, "default")


def test_extract_content_reads_text_values() -> None:
    client = _make_client()
    response = SimpleNamespace(
        output=[SimpleNamespace(content=[SimpleNamespace(text=SimpleNamespace(value='{"ok": true}'))])]
    )

    content = GeminiClient._extract_content(client, response)

    assert content == '{"ok": true}'


def test_extract_content_requires_text() -> None:
    client = _make_client()
    response = SimpleNamespace(output=[])

    with pytest.raises(GeminiError):
        GeminiClient._extract_content(client, response)


def test_parse_json_payload_strips_code_fences() -> None:
    client = _make_client()
    payload = '```json\n{"proposals": []}\n```'

    parsed = GeminiClient._parse_json_payload(client, payload)

    assert parsed == {"proposals": []}


def test_parse_json_payload_raises_for_invalid_json() -> None:
    client = _make_client()

    with pytest.raises(json.JSONDecodeError):
        GeminiClient._parse_json_payload(client, "not-json")


def test_request_analysis_enriches_model_from_response() -> None:
    client = _make_client()

    recorded: dict[str, object] = {}

    def fake_generate(prompt: str, *, generation_config: object) -> SimpleNamespace:
        recorded["prompt"] = prompt
        recorded["generation_config"] = generation_config
        return SimpleNamespace(
            model="gemini-test",
            text='{"proposals": []}',
        )

    client._client = SimpleNamespace(generate_content=fake_generate)  # type: ignore[attr-defined]

    data = GeminiClient._request_analysis(client, "Analyse Notes", 2)

    assert data == {"model": "gemini-test", "proposals": []}
    assert GeminiClient._SYSTEM_PROMPT in recorded["prompt"]
    assert "Analyse Notes" in recorded["prompt"]
    config = recorded["generation_config"]
    schema = _extract_response_schema(config)
    assert not _contains_key(schema, "additionalProperties")
    assert not _contains_key(schema, "default")
    assert schema["properties"]["proposals"]["max_items"] == 2


def test_generate_appeal_sanitizes_schema_before_request() -> None:
    client = _make_client()

    recorded: dict[str, object] = {}

    def fake_generate(prompt: str, *, generation_config: object) -> SimpleNamespace:
        recorded["prompt"] = prompt
        recorded["generation_config"] = generation_config
        return SimpleNamespace(text='{"appeal": ""}')

    client._client = SimpleNamespace(generate_content=fake_generate)  # type: ignore[attr-defined]

    payload = GeminiClient.generate_appeal(
        client,
        prompt="Tell the story",
        response_schema={
            "type": "object",
            "properties": {
                "appeal": {
                    "type": "array",
                    "maxItems": 3,
                    "items": {"type": "string", "minLength": 1},
                }
            },
            "default": {},
        },
    )

    assert payload == {"appeal": ""}
    assert GeminiClient._APPEAL_SYSTEM_PROMPT in recorded["prompt"]
    schema = _extract_response_schema(recorded["generation_config"])
    assert schema["properties"]["appeal"]["max_items"] == 3
    assert not _contains_key(schema, "minLength")
    assert not _contains_key(schema, "default")


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

    prompt = GeminiClient._build_user_prompt(
        client,
        "Investigate login failures",
        3,
        profile,
    )

    assert "Engineer profile:" in prompt
    assert '"experience_years": 6' in prompt
    assert "backend" in prompt
    assert "Investigate login failures" in prompt


def test_load_gemini_configuration_uses_stored_model(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        cipher = get_secret_cipher()
        credential = models.ApiCredential(
            provider="gemini",
            encrypted_secret=cipher.encrypt("sk-live"),
            secret_hint="sk-****",  # noqa: S106 - test data
            is_active=True,
            model="gemini-1.5-pro",
        )
        db.add(credential)
        db.commit()

        secret, model = _load_gemini_configuration(db)
    finally:
        db_gen.close()

    assert secret == "sk-live"  # noqa: S105 - test data
    assert model == "gemini-1.5-pro"


def test_load_gemini_configuration_defaults_to_settings_model(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        cipher = get_secret_cipher()
        credential = models.ApiCredential(
            provider="gemini",
            encrypted_secret=cipher.encrypt("sk-default"),
            is_active=True,
            model=None,
        )
        db.add(credential)
        db.commit()

        secret, model = _load_gemini_configuration(db)
    finally:
        db_gen.close()

    assert secret == "sk-default"  # noqa: S105 - test data
    assert model == settings.gemini_model


def test_load_gemini_configuration_falls_back_to_settings_api_key(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    original_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = "sk-env"

        secret, model = _load_gemini_configuration(db)
    finally:
        settings.gemini_api_key = original_key
        db_gen.close()

    assert secret == "sk-env"  # noqa: S105 - test data
    assert model == settings.gemini_model


def test_load_gemini_configuration_respects_disabled_credential(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    original_key = settings.gemini_api_key
    try:
        cipher = get_secret_cipher()
        credential = models.ApiCredential(
            provider="gemini",
            encrypted_secret=cipher.encrypt("sk-disabled"),
            is_active=False,
        )
        db.add(credential)
        db.commit()

        settings.gemini_api_key = "sk-env"

        with pytest.raises(GeminiConfigurationError):
            _load_gemini_configuration(db)

        db.delete(credential)
        db.commit()
    finally:
        settings.gemini_api_key = original_key
        db_gen.close()
