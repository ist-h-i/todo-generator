from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import settings
from app.routers.cards import DAILY_CARD_CREATION_LIMIT

DEFAULT_PASSWORD = "Register123!"


def register_and_login(client: TestClient, email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    token_payload = response.json()
    assert "access_token" in token_payload
    assert token_payload["user"]["email"] == email
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
        json={
            "name": "Todo",
            "category": "todo",
            "order": 1,
            "color": "#0088ff",
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_label(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/labels",
        json={"name": "Backend", "color": "#ffaa00", "description": "API work"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_card_with_subtasks(client: TestClient) -> None:
    headers = register_and_login(client, "owner@example.com")
    status_id = create_status(client, headers)
    label_id = create_label(client, headers)

    response = client.post(
        "/cards",
        json={
            "title": "Implement API skeleton",
            "summary": "Create FastAPI service with CRUD endpoints",
            "description": "Provide endpoints for cards, subtasks, and labels",
            "status_id": status_id,
            "priority": "high",
            "story_points": 5,
            "assignees": ["user-1"],
            "label_ids": [label_id],
            "subtasks": [
                {"title": "Design data model"},
                {"title": "Implement CRUD"},
            ],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Implement API skeleton"
    assert len(data["subtasks"]) == 2
    assert len(data["labels"]) == 1
    assert data["status"]["id"] == status_id

    list_response = client.get("/cards", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = client.get(f"/cards/{data['id']}", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Implement API skeleton"


def test_subtask_crud_flow(client: TestClient) -> None:
    headers = register_and_login(client, "subtasks@example.com")
    status_id = create_status(client, headers)
    card_response = client.post(
        "/cards",
        json={
            "title": "Prepare release",
            "status_id": status_id,
        },
        headers=headers,
    )
    card = card_response.json()

    create_response = client.post(
        f"/cards/{card['id']}/subtasks",
        json={
            "title": "Write changelog",
            "status": "in-progress",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    subtask = create_response.json()
    assert subtask["title"] == "Write changelog"

    update_response = client.put(
        f"/cards/{card['id']}/subtasks/{subtask['id']}",
        json={"status": "done", "checklist": [{"label": "Publish", "done": True}]},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "done"

    delete_response = client.delete(
        f"/cards/{card['id']}/subtasks/{subtask['id']}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_response = client.get(f"/cards/{card['id']}/subtasks", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_analysis_endpoint(client: TestClient) -> None:
    response = client.post(
        "/analysis",
        json={
            "text": "Fix login bug by adding tests. Also plan feature launch roadmap.",
            "max_cards": 2,
        },
    )

    if settings.chatgpt_api_key:
        assert response.status_code == 200
        data = response.json()
        assert data["model"]
        assert len(data["proposals"]) >= 1
        assert data["proposals"][0]["title"]
    else:
        assert response.status_code == 503


def test_card_creation_daily_limit(client: TestClient) -> None:
    headers = register_and_login(client, "limit@example.com")
    status_id = create_status(client, headers)

    for index in range(DAILY_CARD_CREATION_LIMIT):
        response = client.post(
            "/cards",
            json={"title": f"Card {index}", "status_id": status_id},
            headers=headers,
        )
        assert response.status_code == 201, response.text

    extra_response = client.post(
        "/cards",
        json={"title": "Card beyond limit", "status_id": status_id},
        headers=headers,
    )

    assert extra_response.status_code == 429
    assert (
        extra_response.json()["detail"]
        == f"Daily card creation limit of {DAILY_CARD_CREATION_LIMIT} reached."
    )


def test_cards_are_scoped_to_current_user(client: TestClient) -> None:
    owner_headers = register_and_login(client, "alice@example.com")
    status_id = create_status(client, owner_headers)
    create_response = client.post(
        "/cards",
        json={"title": "Owner card", "status_id": status_id},
        headers=owner_headers,
    )
    assert create_response.status_code == 201
    card_id = create_response.json()["id"]

    other_headers = register_and_login(client, "bob@example.com")
    list_other = client.get("/cards", headers=other_headers)
    assert list_other.status_code == 200
    assert list_other.json() == []

    detail_other = client.get(f"/cards/{card_id}", headers=other_headers)
    assert detail_other.status_code == 404

    list_owner = client.get("/cards", headers=owner_headers)
    assert list_owner.status_code == 200
    assert len(list_owner.json()) == 1


def test_card_creation_daily_limit(client: TestClient) -> None:
    headers = register_and_login(client, "limit@example.com")
    status_id = create_status(client, headers)

    for index in range(DAILY_CARD_CREATION_LIMIT):
        response = client.post(
            "/cards",
            json={"title": f"Task {index}", "status_id": status_id},
            headers=headers,
        )
        assert response.status_code == 201, response.text

    limit_response = client.post(
        "/cards",
        json={"title": "Limit exceeded", "status_id": status_id},
        headers=headers,
    )
    assert limit_response.status_code == 429
    assert (
        limit_response.json()["detail"]
        == "Daily card creation limit reached. Please try again tomorrow."
    )
