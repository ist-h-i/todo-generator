from __future__ import annotations

from fastapi.testclient import TestClient

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
