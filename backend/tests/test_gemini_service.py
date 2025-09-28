import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import models
from app.config import settings
from app.database import get_db
from app.schemas import AnalysisRequest, UserProfile
from app.services.gemini import (
    GeminiClient,
    GeminiConfigurationError,
    _load_active_provider_configuration,
)
from app.services.llm_shared import build_analysis_schema, build_user_prompt
from app.utils.secrets import get_secret_cipher


class StubGenerativeModel:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def generate_content(self, prompt: str, *, generation_config: object) -> SimpleNamespace:
        self.calls.append({"prompt": prompt, "config": generation_config})
        return SimpleNamespace(text=json.dumps({"model": "gemini-test", "proposals": []}))


def test_build_analysis_schema_sets_max_items() -> None:
    schema = build_analysis_schema(3)

    assert schema["properties"]["proposals"]["maxItems"] == 3
    assert schema["properties"]["proposals"]["items"]["required"] == ["title", "summary"]


def test_build_user_prompt_includes_profile_metadata() -> None:
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

    prompt = build_user_prompt("Investigate login failures", 3, profile)

    assert "Engineer profile:" in prompt
    assert '"experience_years": 6' in prompt
    assert "backend" in prompt
    assert "Investigate login failures" in prompt


def test_load_active_provider_prefers_gemini_credential(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        cipher = get_secret_cipher()
        credential = models.ApiCredential(
            provider="gemini",
            encrypted_secret=cipher.encrypt("sk-gemini"),
            secret_hint="sk-****",
            is_active=True,
            model="models/gemini-custom",
        )
        db.add(credential)
        db.commit()

        provider, secret, model = _load_active_provider_configuration(db)
    finally:
        db_gen.close()

    assert provider == "gemini"
    assert secret == "sk-gemini"
    assert model == "models/gemini-custom"


def test_load_active_provider_falls_back_to_openai_when_gemini_missing(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    original_gemini_key = settings.gemini_api_key
    original_gemini_model = settings.gemini_model
    original_chatgpt_key = settings.chatgpt_api_key
    try:
        settings.gemini_api_key = None
        settings.chatgpt_api_key = "sk-openai"

        provider, secret, model = _load_active_provider_configuration(db)
    finally:
        settings.gemini_api_key = original_gemini_key
        settings.gemini_model = original_gemini_model
        settings.chatgpt_api_key = original_chatgpt_key
        db_gen.close()

    assert provider == "openai"
    assert secret == "sk-openai"
    assert model == settings.chatgpt_model


def test_load_active_provider_does_not_fallback_when_gemini_disabled(client: TestClient) -> None:
    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        credential = models.ApiCredential(
            provider="gemini",
            encrypted_secret="unused",
            secret_hint="sk-****",
            is_active=False,
        )
        db.add(credential)
        db.commit()

        with pytest.raises(GeminiConfigurationError) as excinfo:
            _load_active_provider_configuration(db)
    finally:
        db_gen.close()

    assert "Gemini API key is disabled" in str(excinfo.value)


def test_gemini_client_requires_sdk(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gemini.genai", None)

    with pytest.raises(GeminiConfigurationError) as excinfo:
        GeminiClient(api_key="sk-test", model="models/gemini-test")

    assert "Google Generative AI SDK is not installed" in str(excinfo.value)


def test_gemini_client_analyze_uses_shared_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    stub = StubGenerativeModel()
    monkeypatch.setattr("app.services.gemini.genai", SimpleNamespace(
        GenerativeModel=lambda **_: stub,
        GenerationConfig=lambda **kwargs: kwargs,
        configure=lambda **kwargs: None,
    ))

    client = GeminiClient(api_key="sk-test", model="models/gemini-test")
    response = client.analyze(
        AnalysisRequest(text="Draft the roadmap", max_cards=2),
        user_profile=None,
    )

    assert response.model == "gemini-test"
    assert len(response.proposals) == 1
    assert response.proposals[0].title.startswith("Draft the roadmap")
    assert stub.calls, "Expected Gemini client to invoke the SDK"
