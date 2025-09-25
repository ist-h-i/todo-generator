from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.chatgpt import ChatGPTError, get_optional_chatgpt_client

from .test_cards import DEFAULT_PASSWORD as CARD_DEFAULT_PASSWORD


def register_and_login(client: TestClient, email: str, password: str = CARD_DEFAULT_PASSWORD) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_status(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/statuses",
        json={"name": "Todo", "category": "todo", "order": 1},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def create_label(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/labels",
        json={"name": "Growth", "color": "#0088ff", "description": "成果の共有"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
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
    assert response.status_code == 201, response.text


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
    assert response.status_code == 200, response.text
    payload = response.json()
    assert {fmt["id"] for fmt in payload["formats"]} >= {"markdown", "bullet_list"}

    label_entries = [entry for entry in payload["labels"] if entry["id"] == label_id]
    assert label_entries, "Expected created label to appear in config"
    assert label_entries[0]["achievements"], "Expected achievements derived from cards"


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
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subject_echo"] == "Growth"
    assert body["warnings"], "Expected warning when 実績 is present without 課題"

    markdown_content = body["formats"]["markdown"]["content"]
    assert "そのため" in markdown_content
    assert "結果として" in markdown_content

    bullet_content = body["formats"]["bullet_list"]["content"]
    assert "結果として" in bullet_content

    table_content = body["formats"]["table"]["content"]
    assert "結果として" in table_content.splitlines()[-1]


def test_generate_appeal_sanitizes_custom_subject(client: TestClient) -> None:
    headers = register_and_login(client, "appeal-custom@example.com")

    payload = {
        "subject": {"type": "custom", "value": "<script>alert('x')</script>品質向上"},
        "flow": ["課題", "対策", "実績"],
        "formats": ["markdown"],
        "achievements": [{"id": "manual", "title": "品質改善", "summary": "レビュー体制を強化"}],
    }
    response = client.post("/appeals/generate", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subject_echo"].startswith("&lt;script&gt;alert")
    markdown_content = body["formats"]["markdown"]["content"]
    assert "品質改善" in markdown_content
    assert "そのため" in markdown_content
    assert "結果として" in markdown_content


def test_generate_appeal_uses_chatgpt_when_available(monkeypatch, client: TestClient) -> None:
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

    class StubChatGPT:
        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, object]]] = []

        def generate_appeal(self, *, prompt: str, response_schema: dict[str, object]) -> dict[str, object]:
            self.calls.append((prompt, response_schema))
            return {
                "formats": {
                    "markdown": {"content": "## 実績\n成果を共有。", "tokens_used": 42},
                    "bullet_list": {"content": "- 主要な取り組みを整理", "tokens_used": 18},
                },
                "token_usage": {"total_tokens": 60},
            }

    stub = StubChatGPT()

    def fake_chatgpt_dependency(db=None):  # type: ignore[unused-argument]
        return stub

    app.dependency_overrides[get_optional_chatgpt_client] = fake_chatgpt_dependency

    payload = {
        "subject": {"type": "label", "value": label_id},
        "flow": ["課題", "実績"],
        "formats": ["markdown", "bullet_list", "table"],
    }
    try:
        response = client.post("/appeals/generate", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_optional_chatgpt_client, None)
    assert response.status_code == 200, response.text

    assert stub.calls, "Expected ChatGPT stub to be invoked"
    prompt_text, schema = stub.calls[0]
    assert "Required connective phrases" in prompt_text
    assert "markdown" in prompt_text
    assert schema["type"] == "object"

    body = response.json()
    markdown_content = body["formats"]["markdown"]["content"]
    assert "そのため" in markdown_content
    assert "結果として" in markdown_content

    bullet_content = body["formats"]["bullet_list"]["content"]
    assert bullet_content.startswith("- そのため")
    assert "結果として" in body["formats"]["table"]["content"]

    assert body["formats"]["markdown"]["tokens_used"] == 42
    assert body["formats"]["bullet_list"]["tokens_used"] == 18
    assert body["formats"]["table"]["tokens_used"] == 0


def test_generate_appeal_recovers_from_chatgpt_failure(monkeypatch, client: TestClient) -> None:
    headers = register_and_login(client, "appeal-fallback@example.com")

    class FailingChatGPT:
        def generate_appeal(self, *, prompt: str, response_schema: dict[str, object]) -> dict[str, object]:
            raise ChatGPTError("boom")

    def fake_chatgpt_dependency(db=None):  # type: ignore[unused-argument]
        return FailingChatGPT()

    app.dependency_overrides[get_optional_chatgpt_client] = fake_chatgpt_dependency

    payload = {
        "subject": {"type": "custom", "value": "サービス改善"},
        "flow": ["実績"],
        "formats": ["markdown", "table"],
    }

    try:
        response = client.post("/appeals/generate", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_optional_chatgpt_client, None)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["formats"]["markdown"]["tokens_used"] == 0
    assert body["formats"]["table"]["tokens_used"] == 0
    assert "そのため" in body["formats"]["markdown"]["content"]
    assert "結果として" in body["formats"]["table"]["content"]
