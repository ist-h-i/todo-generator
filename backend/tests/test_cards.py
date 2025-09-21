from __future__ import annotations

from fastapi.testclient import TestClient


def create_status(client: TestClient) -> str:
    response = client.post(
        "/statuses",
        json={
            "name": "Todo",
            "category": "todo",
            "order": 1,
            "color": "#0088ff",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_label(client: TestClient) -> str:
    response = client.post(
        "/labels",
        json={"name": "Backend", "color": "#ffaa00", "description": "API work"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_card_with_subtasks(client: TestClient) -> None:
    status_id = create_status(client)
    label_id = create_label(client)

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
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Implement API skeleton"
    assert len(data["subtasks"]) == 2
    assert len(data["labels"]) == 1
    assert data["status"]["id"] == status_id

    list_response = client.get("/cards")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = client.get(f"/cards/{data['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Implement API skeleton"


def test_subtask_crud_flow(client: TestClient) -> None:
    status_id = create_status(client)
    card_response = client.post(
        "/cards",
        json={
            "title": "Prepare release",
            "status_id": status_id,
        },
    )
    card = card_response.json()

    create_response = client.post(
        f"/cards/{card['id']}/subtasks",
        json={
            "title": "Write changelog",
            "status": "in-progress",
        },
    )
    assert create_response.status_code == 201
    subtask = create_response.json()
    assert subtask["title"] == "Write changelog"

    update_response = client.put(
        f"/cards/{card['id']}/subtasks/{subtask['id']}",
        json={"status": "done", "checklist": [{"label": "Publish", "done": True}]},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "done"

    delete_response = client.delete(
        f"/cards/{card['id']}/subtasks/{subtask['id']}"
    )
    assert delete_response.status_code == 204

    list_response = client.get(f"/cards/{card['id']}/subtasks")
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
    assert response.status_code == 200
    data = response.json()
    assert data["model"]
    assert len(data["proposals"]) >= 1
    assert data["proposals"][0]["title"]
