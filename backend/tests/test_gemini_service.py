from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest import TestCase

import pytest
from fastapi.testclient import TestClient

from app import models
from app.auth import hash_password
from app.config import settings
from app.database import get_db
from app.schemas import UserProfile
from app.services.gemini import (
    AnalysisWorkspaceLabelOption,
    AnalysisWorkspaceOptions,
    AnalysisWorkspaceStatusOption,
    GeminiClient,
    GeminiConfigurationError,
    GeminiError,
    ResourceExhausted,
    _load_gemini_configuration,
    build_workspace_analysis_options,
)
from app.utils.secrets import get_secret_cipher

assertions = TestCase()


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

    assertions.assertTrue(result["type"] == "json_schema")
    json_schema = result["json_schema"]
    assertions.assertTrue(json_schema["name"] == "analysis_response")
    assertions.assertTrue(json_schema["strict"] is True)
    proposals_schema = json_schema["schema"]["properties"]["proposals"]
    assertions.assertTrue(proposals_schema["max_items"] == 4)
    assertions.assertTrue("maxItems" not in proposals_schema)


def test_build_response_format_removes_unsupported_keys() -> None:
    client = _make_client()

    schema = GeminiClient._build_response_format(client, 2)["json_schema"]["schema"]

    assertions.assertTrue(not _contains_key(schema, "maxItems"))
    assertions.assertTrue(not _contains_key(schema, "default"))
    assertions.assertTrue(not _contains_key(schema, "additionalProperties"))


def test_build_response_format_is_idempotent() -> None:
    client = _make_client()

    first = GeminiClient._build_response_format(client, 1)
    second = GeminiClient._build_response_format(client, 6)

    first_schema = first["json_schema"]["schema"]["properties"]["proposals"]
    second_schema = second["json_schema"]["schema"]["properties"]["proposals"]

    assertions.assertTrue("maxItems" not in first_schema)
    assertions.assertTrue("maxItems" not in second_schema)
    assertions.assertTrue(first_schema["max_items"] == 1)
    assertions.assertTrue(second_schema["max_items"] == 6)


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

    assertions.assertTrue("maxItems" in schema)
    assertions.assertTrue("maxItems" not in sanitized)
    assertions.assertTrue(sanitized["max_items"] == 5)
    values_schema = sanitized["items"]["properties"]["values"]
    assertions.assertTrue(values_schema["max_items"] == 3)
    assertions.assertTrue("minLength" not in values_schema["items"])
    assertions.assertTrue("default" not in values_schema)
    assertions.assertTrue(not _contains_key(sanitized, "minItems"))
    assertions.assertTrue(not _contains_key(sanitized, "additionalProperties"))
    assertions.assertTrue(sanitized["items"] is not schema["items"])


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

    assertions.assertTrue(set(sanitized["properties"].keys()) == {"title", "description"})
    assertions.assertTrue(sanitized["properties"]["title"] == {"type": "string"})
    assertions.assertTrue(sanitized["properties"]["description"] == {"type": "string"})


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

    assertions.assertTrue(not _contains_key(schema, "maxItems"))
    assertions.assertTrue(schema["properties"]["items"]["max_items"] == 4)
    assertions.assertTrue(not _contains_key(schema, "pattern"))
    assertions.assertTrue(not _contains_key(schema, "default"))


def test_extract_content_reads_text_values() -> None:
    client = _make_client()
    response = SimpleNamespace(
        output=[SimpleNamespace(content=[SimpleNamespace(text=SimpleNamespace(value='{"ok": true}'))])]
    )

    content = GeminiClient._extract_content(client, response)

    assertions.assertTrue(content == '{"ok": true}')


def test_extract_content_requires_text() -> None:
    client = _make_client()
    response = SimpleNamespace(output=[])

    with pytest.raises(GeminiError):
        GeminiClient._extract_content(client, response)


def test_parse_json_payload_strips_code_fences() -> None:
    client = _make_client()
    payload = '```json\n{"proposals": []}\n```'

    parsed = GeminiClient._parse_json_payload(client, payload)

    assertions.assertTrue(parsed == {"proposals": []})


def test_parse_json_payload_raises_for_invalid_json() -> None:
    client = _make_client()

    with pytest.raises(json.JSONDecodeError):
        GeminiClient._parse_json_payload(client, "not-json")


def test_request_analysis_enriches_model_from_response() -> None:
    client = _make_client()

    recorded: dict[str, object] = {}

    def fake_generate(
        prompt: str, *, generation_config: object, request_options: object | None = None
    ) -> SimpleNamespace:
        recorded["prompt"] = prompt
        recorded["generation_config"] = generation_config
        recorded["request_options"] = request_options
        return SimpleNamespace(
            model="gemini-test",
            text='{"proposals": []}',
        )

    client._client = SimpleNamespace(generate_content=fake_generate)  # type: ignore[attr-defined]

    data = GeminiClient._request_analysis(client, "Analyse Notes", 2)

    assertions.assertTrue(data == {"model": "gemini-test", "proposals": []})
    assertions.assertTrue(GeminiClient._SYSTEM_PROMPT in recorded["prompt"])
    assertions.assertTrue("Analyse Notes" in recorded["prompt"])
    config = recorded["generation_config"]
    schema = _extract_response_schema(config)
    assertions.assertTrue(not _contains_key(schema, "additionalProperties"))
    assertions.assertTrue(not _contains_key(schema, "default"))
    assertions.assertTrue(schema["properties"]["proposals"]["max_items"] == 2)
    assertions.assertTrue(
        recorded["request_options"] == {"retry": None, "timeout": settings.gemini_request_timeout_seconds}
    )


def test_request_analysis_falls_back_when_model_has_zero_quota() -> None:
    client = _make_client()
    client.model = "models/gemini-2.0-flash-lite"

    calls: dict[str, int] = {"primary": 0, "fallback": 0}

    def primary_generate(
        prompt: str, *, generation_config: object, request_options: object | None = None
    ) -> SimpleNamespace:
        calls["primary"] += 1
        raise ResourceExhausted(
            "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, "
            "limit: 0, model: gemini-2.0-flash-lite"
        )

    def fallback_generate(
        prompt: str, *, generation_config: object, request_options: object | None = None
    ) -> SimpleNamespace:
        calls["fallback"] += 1
        return SimpleNamespace(model="models/gemini-2.0-flash", text='{"proposals": []}')

    primary_client = SimpleNamespace(generate_content=primary_generate)
    fallback_client = SimpleNamespace(generate_content=fallback_generate)
    client._client = primary_client  # type: ignore[attr-defined]

    def fake_get_model_client(model_override: str | None) -> tuple[object, str]:
        if model_override is None:
            return primary_client, client.model
        return fallback_client, model_override

    client._get_model_client = fake_get_model_client  # type: ignore[method-assign]

    data = GeminiClient._request_analysis(client, "Analyse Notes", 2)

    assertions.assertTrue(data["model"] == "models/gemini-2.0-flash")
    assertions.assertTrue(data["proposals"] == [])
    warnings = data.get("warnings") or []
    assertions.assertTrue(isinstance(warnings, list))
    assertions.assertTrue(len(warnings) == 0)
    assertions.assertTrue(calls["primary"] == 1)
    assertions.assertTrue(calls["fallback"] == 1)


def test_generate_appeal_sanitizes_schema_before_request() -> None:
    client = _make_client()

    recorded: dict[str, object] = {}

    def fake_generate(
        prompt: str, *, generation_config: object, request_options: object | None = None
    ) -> SimpleNamespace:
        recorded["prompt"] = prompt
        recorded["generation_config"] = generation_config
        recorded["request_options"] = request_options
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

    assertions.assertTrue(payload == {"appeal": "", "model": "test-model"})
    assertions.assertTrue(GeminiClient._APPEAL_SYSTEM_PROMPT in recorded["prompt"])
    schema = _extract_response_schema(recorded["generation_config"])
    assertions.assertTrue(schema["properties"]["appeal"]["max_items"] == 3)
    assertions.assertTrue(not _contains_key(schema, "minLength"))
    assertions.assertTrue(not _contains_key(schema, "default"))
    assertions.assertTrue(
        recorded["request_options"] == {"retry": None, "timeout": settings.gemini_request_timeout_seconds}
    )


def test_request_analysis_overrides_untrusted_model_field() -> None:
    client = _make_client()

    def fake_generate(
        prompt: str, *, generation_config: object, request_options: object | None = None
    ) -> SimpleNamespace:
        return SimpleNamespace(
            model="gemini-real",
            text='{"model": "gemini-fake", "proposals": []}',
        )

    client._client = SimpleNamespace(generate_content=fake_generate)  # type: ignore[attr-defined]

    data = GeminiClient._request_analysis(client, "Analyse Notes", 2)

    assertions.assertTrue(data["model"] == "gemini-real")
    assertions.assertTrue(data["proposals"] == [])


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

    assertions.assertTrue("Engineer profile:" in prompt)
    assertions.assertTrue('"experience_years": 6' in prompt)
    assertions.assertTrue("backend" in prompt)
    assertions.assertTrue("Investigate login failures" in prompt)


def test_build_user_prompt_lists_workspace_options() -> None:
    client = _make_client()
    options = AnalysisWorkspaceOptions(
        statuses=(
            AnalysisWorkspaceStatusOption(
                id="status-todo",
                name="To Do",
                category="todo",
            ),
            AnalysisWorkspaceStatusOption(
                id="status-doing",
                name="Doing",
                category="in-progress",
            ),
        ),
        labels=(
            AnalysisWorkspaceLabelOption(id="label-ai", name="AI"),
            AnalysisWorkspaceLabelOption(id="label-bug", name="Bug"),
        ),
        default_status_id="status-todo",
        preferred_label_ids=("label-ai",),
    )

    prompt = GeminiClient._build_user_prompt(
        client,
        "Review analytics backlog",
        2,
        None,
        options,
    )

    assertions.assertTrue("Available statuses" in prompt)
    assertions.assertTrue("status-todo" in prompt)
    assertions.assertTrue("Doing" in prompt)
    assertions.assertTrue("default to status 'To Do'" in prompt)
    assertions.assertTrue("Available labels registered by the current user" in prompt)
    assertions.assertTrue("general-purpose label" in prompt)
    assertions.assertTrue("AI" in prompt)
    assertions.assertTrue("create a new concise label name" in prompt)


def test_build_workspace_analysis_options_prefers_defaults(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        user = models.User(
            email="workspace-options@example.com",
            password_hash=hash_password("Workspace123!"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        label = models.Label(name="AI", owner_id=user.id)
        db.add(label)
        db.commit()
        db.refresh(label)

        label_id = label.id
        options = build_workspace_analysis_options(db, owner_id=user.id)
    finally:
        db_gen.close()

    assertions.assertTrue(options.statuses)
    status_names = {status.name for status in options.statuses}
    assertions.assertTrue("To Do" in status_names)
    assertions.assertTrue(options.default_status_id is not None)
    label_names = {label.name for label in options.labels}
    assertions.assertTrue("AI" in label_names)
    assertions.assertTrue(label_id in set(options.preferred_label_ids))


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

    assertions.assertTrue(secret == "sk-live")  # noqa: S105
    assertions.assertTrue(model == "gemini-1.5-pro")


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

    assertions.assertTrue(secret == "sk-default")  # noqa: S105
    assertions.assertTrue(model == settings.gemini_model)


def test_load_gemini_configuration_replaces_deprecated_model(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        cipher = get_secret_cipher()
        credential = models.ApiCredential(
            provider="gemini",
            encrypted_secret=cipher.encrypt("sk-deprecated"),
            is_active=True,
            model="models/gemini-2.0-flash-exp",
        )
        db.add(credential)
        db.commit()

        secret, model = _load_gemini_configuration(db)
        db.refresh(credential)
    finally:
        db_gen.close()

    expected = GeminiClient.normalize_model_name(settings.gemini_model)
    assertions.assertTrue(secret == "sk-deprecated")  # noqa: S105
    assertions.assertTrue(model == expected)
    assertions.assertTrue(credential.model == expected)


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

    assertions.assertTrue(secret == "sk-env")  # noqa: S105
    assertions.assertTrue(model == settings.gemini_model)


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


def test_normalize_model_name_maps_flash_families() -> None:
    assertions.assertTrue(GeminiClient.normalize_model_name("gemini-1.5-flash") == "models/gemini-1.5-flash")
    assertions.assertTrue(
        GeminiClient.normalize_model_name("gemini-1.5-flash-latest") == "models/gemini-1.5-flash-latest"
    )
    assertions.assertTrue(GeminiClient.normalize_model_name("models/gemini-1.5-flash") == "models/gemini-1.5-flash")
    assertions.assertTrue(
        GeminiClient.normalize_model_name("models/gemini-1.5-flash-latest") == "models/gemini-1.5-flash-latest"
    )
    assertions.assertTrue(GeminiClient.normalize_model_name("gemini-2.0-flash") == "models/gemini-2.0-flash")
    assertions.assertTrue(GeminiClient.normalize_model_name("gemini-2.0-flash-lite") == "models/gemini-2.0-flash-lite")
    assertions.assertTrue(GeminiClient.normalize_model_name("models/gemini-2.0-flash") == "models/gemini-2.0-flash")


def test_sanitize_model_name_replaces_deprecated_models() -> None:
    default_model = GeminiClient.normalize_model_name(settings.gemini_model)
    assertions.assertTrue(
        GeminiClient.sanitize_model_name("models/gemini-2.0-flash-exp", fallback=default_model)
        == default_model
    )
    assertions.assertTrue(
        GeminiClient.sanitize_model_name("gemini-1.0-pro", fallback=default_model)
        == default_model
    )
    assertions.assertTrue(
        GeminiClient.sanitize_model_name("models/gemini-1.5-flash", fallback=default_model)
        == default_model
    )


def test_sanitize_model_name_uses_supported_default_when_all_fallbacks_deprecated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "gemini_model", "models/gemini-1.0-pro", raising=False)
    default_model = GeminiClient.normalize_model_name(settings.gemini_model)

    sanitized = GeminiClient.sanitize_model_name("models/gemini-1.0-pro", fallback=default_model)

    assertions.assertTrue(sanitized == "models/gemini-2.5-flash")


def test_client_resolves_available_flash_variant(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeModel:
        def __init__(self, name: str, methods: tuple[str, ...]) -> None:
            self.name = name
            self.supported_generation_methods = methods

    configured: dict[str, object] = {}

    def fake_configure(api_key: str | None = None, **_: object) -> None:
        configured["api_key"] = api_key

    def fake_list_models() -> list[FakeModel]:
        return [
            FakeModel("models/gemini-2.0-flash-001", ("generateContent",)),
            FakeModel("models/gemini-2.0-flash-002", ("generateContent",)),
        ]

    class DummyGenerativeModel:
        def __init__(self, name: str) -> None:
            self.name = name

    monkeypatch.setattr(
        "app.services.gemini.genai",
        SimpleNamespace(
            configure=fake_configure,
            list_models=fake_list_models,
            GenerativeModel=DummyGenerativeModel,
            types=SimpleNamespace(GenerationConfig=None),
        ),
    )

    client = GeminiClient(model="models/gemini-2.0-flash", api_key="sk-test")

    assertions.assertTrue(configured["api_key"] == "sk-test")
    assertions.assertTrue(client.model == "models/gemini-2.0-flash-002")
    assertions.assertTrue(isinstance(client._client, DummyGenerativeModel))
    assertions.assertTrue(client._client.name == "models/gemini-2.0-flash-002")


def test_client_resolves_available_preview_variant(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeModel:
        def __init__(self, name: str, methods: tuple[str, ...]) -> None:
            self.name = name
            self.supported_generation_methods = methods

    def fake_list_models() -> list[FakeModel]:
        return [
            FakeModel("models/gemini-3-flash-preview", ("generateContent",)),
            FakeModel("models/gemini-3-pro-preview", ("generateContent",)),
        ]

    class DummyGenerativeModel:
        def __init__(self, name: str) -> None:
            self.name = name

    monkeypatch.setattr(
        "app.services.gemini.genai",
        SimpleNamespace(
            configure=lambda **_: None,
            list_models=fake_list_models,
            GenerativeModel=DummyGenerativeModel,
            types=SimpleNamespace(GenerationConfig=None),
        ),
    )

    client = GeminiClient(model="models/gemini-3-flash", api_key="sk-preview")

    assertions.assertTrue(client.model == "models/gemini-3-flash-preview")


def test_client_raises_when_requested_model_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeModel:
        def __init__(self, name: str, methods: tuple[str, ...]) -> None:
            self.name = name
            self.supported_generation_methods = methods

    monkeypatch.setattr(
        "app.services.gemini.genai",
        SimpleNamespace(
            configure=lambda **_: None,
            list_models=lambda: [FakeModel("models/gemini-pro", ("generateContent",))],
            GenerativeModel=lambda name: SimpleNamespace(name=name),
            types=SimpleNamespace(GenerationConfig=None),
        ),
    )

    with pytest.raises(GeminiConfigurationError):
        GeminiClient(model="models/does-not-exist", api_key="sk-missing")


def test_client_keeps_model_when_catalog_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def failing_list_models() -> list[object]:
        raise RuntimeError("discovery failed")

    monkeypatch.setattr(
        "app.services.gemini.genai",
        SimpleNamespace(
            configure=lambda **_: None,
            list_models=failing_list_models,
            GenerativeModel=lambda name: SimpleNamespace(name=name),
            types=SimpleNamespace(GenerationConfig=None),
        ),
    )

    client = GeminiClient(model="models/gemini-2.0-flash", api_key="sk-fallback")

    assertions.assertTrue(client.model == "models/gemini-2.0-flash")
