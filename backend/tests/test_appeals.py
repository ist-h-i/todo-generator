from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any
from unittest import TestCase

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.gemini import GeminiClient, GeminiError, get_optional_gemini_client

from .test_cards import DEFAULT_PASSWORD as CARD_DEFAULT_PASSWORD
from .utils.auth import register_user

assertions = TestCase()


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


def register_and_login(client: TestClient, email: str, password: str = CARD_DEFAULT_PASSWORD) -> dict[str, str]:
    register_user(
        client, email=email, password=password, nickname="AppealsUser"
    )
    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assertions.assertTrue(login_response.status_code == 200, login_response.text)
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_status(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/statuses",
        json={"name": "Todo", "category": "todo", "order": 1},
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 201, response.text)
    return response.json()["id"]


def create_label(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/labels",
        json={"name": "Growth", "color": "#0088ff", "description": "成果の共有"},
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 201, response.text)
    return response.json()["id"]


def create_card_with_label(
    client: TestClient,
    headers: dict[str, str],
    status_id: str,
    label_id: str,
    title: str,
    summary: str,
) -> None:
    response = client.post(
        "/cards",
        json={
            "title": title,
            "summary": summary,
            "status_id": status_id,
            "label_ids": [label_id],
        },
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 201, response.text)


def test_get_config_returns_labels_and_formats(client: TestClient) -> None:
    headers = register_and_login(client, "appeal-config@example.com")
    status_id = create_status(client, headers)
    label_id = create_label(client, headers)
    create_card_with_label(
        client,
        headers,
        status_id,
        label_id,
        title="成果レポートを整理",
        summary="チームの KPI 達成に貢献した施策をまとめた。",
    )

    response = client.get("/appeals/config", headers=headers)
    assertions.assertTrue(response.status_code == 200, response.text)
    payload = response.json()
    assertions.assertTrue({fmt["id"] for fmt in payload["formats"]} >= {"markdown", "bullet_list"})

    label_entries = [entry for entry in payload["labels"] if entry["id"] == label_id]
    assertions.assertTrue(label_entries, "Expected created label to appear in config")
    assertions.assertTrue(label_entries[0]["achievements"], "Expected achievements derived from cards")


def test_generate_appeal_with_label_subject_returns_content(client: TestClient) -> None:
    headers = register_and_login(client, "appeal-generate@example.com")
    status_id = create_status(client, headers)
    label_id = create_label(client, headers)
    create_card_with_label(
        client,
        headers,
        status_id,
        label_id,
        title="社内勉強会を主催",
        summary="最新の開発ベストプラクティスを共有し参加者満足度90%を達成。",
    )

    payload = {
        "subject": {"type": "label", "value": label_id},
        "flow": ["実績"],
        "formats": ["markdown", "bullet_list", "table"],
    }
    response = client.post("/appeals/generate", json=payload, headers=headers)
    assertions.assertTrue(response.status_code == 200, response.text)
    body = response.json()
    assertions.assertTrue(body["subject_echo"] == "Growth")
    assertions.assertTrue(body["warnings"], "Expected warning when 実績 is present without 課題")

    markdown_content = body["formats"]["markdown"]["content"]
    assertions.assertTrue("そのため" in markdown_content)
    assertions.assertTrue("結果として" in markdown_content)

    bullet_content = body["formats"]["bullet_list"]["content"]
    assertions.assertTrue("結果として" in bullet_content)

    table_content = body["formats"]["table"]["content"]
    assertions.assertTrue("結果として" in table_content.splitlines()[-1])


def test_generate_appeal_sanitizes_custom_subject(client: TestClient) -> None:
    headers = register_and_login(client, "appeal-custom@example.com")

    payload = {
        "subject": {"type": "custom", "value": "<script>alert('x')</script>品質向上"},
        "flow": ["課題", "対策", "実績"],
        "formats": ["markdown"],
        "achievements": [{"id": "manual", "title": "品質改善", "summary": "レビュー体制を強化"}],
    }
    response = client.post("/appeals/generate", json=payload, headers=headers)
    assertions.assertTrue(response.status_code == 200, response.text)
    body = response.json()
    assertions.assertTrue(body["subject_echo"].startswith("&lt;script&gt;alert"))
    markdown_content = body["formats"]["markdown"]["content"]
    assertions.assertTrue("品質改善" in markdown_content)
    assertions.assertTrue("そのため" in markdown_content)
    assertions.assertTrue("結果として" in markdown_content)


def test_generate_appeal_uses_gemini_when_available(monkeypatch, client: TestClient) -> None:
    headers = register_and_login(client, "appeal-ai@example.com")
    status_id = create_status(client, headers)
    label_id = create_label(client, headers)
    create_card_with_label(
        client,
        headers,
        status_id,
        label_id,
        title="品質向上の取り組み",
        summary="レビュー体制を刷新し重大バグを50%削減。",
    )

    recorded: dict[str, object] = {}

    def fake_generate_content(
        prompt: str, *, generation_config: object, request_options: object | None = None
    ) -> SimpleNamespace:
        recorded["prompt"] = prompt
        recorded["generation_config"] = generation_config
        recorded["request_options"] = request_options
        payload = {
            "formats": {
                "markdown": {"content": "## 実績\n成果を共有。", "tokens_used": 42},
                "bullet_list": {"content": "- 主要な取り組みを整理", "tokens_used": 18},
            },
            "token_usage": {"total_tokens": 60},
        }
        return SimpleNamespace(text=json.dumps(payload))

    gemini_client = object.__new__(GeminiClient)
    gemini_client.model = "test-model"
    gemini_client.api_key = "test-key"
    gemini_client._client = SimpleNamespace(generate_content=fake_generate_content)  # type: ignore[attr-defined]

    def fake_gemini_dependency(db=None):  # type: ignore[unused-argument]
        return gemini_client

    app.dependency_overrides[get_optional_gemini_client] = fake_gemini_dependency

    payload = {
        "subject": {"type": "label", "value": label_id},
        "flow": ["課題", "実績"],
        "formats": ["markdown", "bullet_list", "table"],
    }
    try:
        response = client.post("/appeals/generate", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_optional_gemini_client, None)
    assertions.assertTrue(response.status_code == 200, response.text)

    assertions.assertTrue(recorded, "Expected Gemini client to be invoked")
    prompt_text = recorded["prompt"]
    assertions.assertTrue("Required connective phrases" in prompt_text)
    assertions.assertTrue("markdown" in prompt_text)
    generation_config = recorded["generation_config"]
    response_schema = _extract_response_schema(generation_config)
    assertions.assertTrue(response_schema["type"] == "object")
    assertions.assertTrue(not _contains_key(response_schema, "additionalProperties"))
    assertions.assertTrue(
        recorded.get("request_options")
        == {"retry": None, "timeout": settings.gemini_request_timeout_seconds}
    )

    body = response.json()
    markdown_content = body["formats"]["markdown"]["content"]
    assertions.assertTrue("そのため" in markdown_content)
    assertions.assertTrue("結果として" in markdown_content)

    bullet_content = body["formats"]["bullet_list"]["content"]
    assertions.assertTrue(bullet_content.startswith("- そのため"))
    assertions.assertTrue("結果として" in body["formats"]["table"]["content"])

    assertions.assertTrue(body["formats"]["markdown"]["tokens_used"] == 42)
    assertions.assertTrue(body["formats"]["bullet_list"]["tokens_used"] == 18)
    assertions.assertTrue(body["formats"]["table"]["tokens_used"] == 0)
    assertions.assertTrue(body["generation_status"] == "partial")
    assertions.assertTrue(body["ai_failure_reason"] is None)


def test_generate_appeal_recovers_from_gemini_failure(monkeypatch, client: TestClient) -> None:
    headers = register_and_login(client, "appeal-fallback@example.com")

    class FailingGemini:
        def generate_appeal(self, *, prompt: str, response_schema: dict[str, object]) -> dict[str, object]:
            raise GeminiError("boom")

    def fake_gemini_dependency(db=None):  # type: ignore[unused-argument]
        return FailingGemini()

    app.dependency_overrides[get_optional_gemini_client] = fake_gemini_dependency

    payload = {
        "subject": {"type": "custom", "value": "サービス改善"},
        "flow": ["実績"],
        "formats": ["markdown", "table"],
    }

    try:
        response = client.post("/appeals/generate", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_optional_gemini_client, None)
    assertions.assertTrue(response.status_code == 200, response.text)
    body = response.json()
    assertions.assertTrue(body["generation_status"] == "fallback")
    assertions.assertTrue("boom" in (body.get("ai_failure_reason") or ""))
    assertions.assertTrue(body["formats"]["markdown"]["tokens_used"] == 0)
    assertions.assertTrue(body["formats"]["table"]["tokens_used"] == 0)
    assertions.assertTrue("そのため" in body["formats"]["markdown"]["content"])
    assertions.assertTrue("結果として" in body["formats"]["table"]["content"])
