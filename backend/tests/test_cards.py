from __future__ import annotations

from fastapi.testclient import TestClient

from app.routers import cards as cards_router
from app.services.recommendation_scoring import RecommendationScore
from app.utils.quotas import DEFAULT_CARD_DAILY_LIMIT

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


def test_card_creation_populates_recommendation_score(client: TestClient) -> None:
    email = "score@example.com"
    headers = register_and_login(client, email)
    status_id = create_status(client, headers)
    label_id = create_label(client, headers)

    response = client.post(
        "/cards",
        json={
            "title": "Backend API alignment",
            "summary": "Review backend integration tasks",
            "description": "Ensure API endpoints match the backend label expectations.",
            "status_id": status_id,
            "label_ids": [label_id],
            "ai_confidence": 1,
            "ai_notes": "manual override",
            "ai_failure_reason": "client provided",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()

    assert 0 <= data["ai_confidence"] <= 100
    assert data["ai_confidence"] > 0
    assert data["ai_notes"].startswith("ラベル相関度")
    assert data["ai_failure_reason"] is None

    card_id = data["id"]

    update_response = client.put(
        f"/cards/{card_id}",
        json={"label_ids": [], "ai_failure_reason": "client override"},
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()

    assert updated["ai_confidence"] == 0
    assert "ラベルが未設定" in updated["ai_notes"]
    assert updated["ai_failure_reason"] is None


def test_card_creation_scoring_failure_sets_failure_reason(client: TestClient, monkeypatch) -> None:
    email = "failure@example.com"
    headers = register_and_login(client, email)
    status_id = create_status(client, headers)

    def fake_score_card(
        *,
        title: str,
        summary: str | None,
        description: str | None,
        labels: list[str],
        profile,
    ) -> RecommendationScore:
        return RecommendationScore(
            score=0,
            label_correlation=0.0,
            profile_alignment=0.0,
            explanation="fallback message",
            failure_reason="scoring_error",
        )

    monkeypatch.setattr(cards_router._scoring_service, "score_card", fake_score_card)

    response = client.post(
        "/cards",
        json={
            "title": "Trigger fallback",
            "summary": "",
            "description": "",
            "status_id": status_id,
            "ai_failure_reason": "client attempt",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["ai_confidence"] == 0
    assert data["ai_notes"] == "fallback message"
    assert data["ai_failure_reason"] == "scoring_error"

    update_response = client.put(
        f"/cards/{data['id']}",
        json={"title": "Updated title", "ai_failure_reason": "client attempt"},
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()

    assert updated["ai_confidence"] == 0
    assert updated["ai_notes"] == "fallback message"
    assert updated["ai_failure_reason"] == "scoring_error"


def test_create_card_with_subtasks(client: TestClient) -> None:
    email = "owner@example.com"
    headers = register_and_login(client, email)
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
    email = "subtasks@example.com"
    headers = register_and_login(client, email)
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
    headers = register_and_login(client, "analysis@example.com")
    response = client.post(
        "/analysis",
        json={
            "text": "Fix login bug by adding tests. Also plan feature launch roadmap.",
            "max_cards": 2,
        },
        headers=headers,
    )

    if response.status_code == 200:
        data = response.json()
        assert data["model"]
        assert len(data["proposals"]) >= 1
        assert data["proposals"][0]["title"]
    else:
        assert response.status_code == 503


def test_card_creation_daily_limit(client: TestClient) -> None:
    email = "limit@example.com"
    headers = register_and_login(client, email)
    status_id = create_status(client, headers)

    for index in range(DEFAULT_CARD_DAILY_LIMIT):
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
    assert extra_response.json()["detail"] == f"Daily card creation limit of {DEFAULT_CARD_DAILY_LIMIT} reached."


def test_cards_are_scoped_to_current_user(client: TestClient) -> None:
    owner_email = "alice@example.com"
    owner_headers = register_and_login(client, owner_email)
    status_id = create_status(client, owner_headers)
    create_response = client.post(
        "/cards",
        json={"title": "Owner card", "status_id": status_id},
        headers=owner_headers,
    )
    assert create_response.status_code == 201
    card_id = create_response.json()["id"]

    other_email = "bob@example.com"
    other_headers = register_and_login(client, other_email)
    list_other = client.get("/cards", headers=other_headers)
    assert list_other.status_code == 200
    assert list_other.json() == []

    detail_other = client.get(f"/cards/{card_id}", headers=other_headers)
    assert detail_other.status_code == 404

    list_owner = client.get("/cards", headers=owner_headers)
    assert list_owner.status_code == 200
    assert len(list_owner.json()) == 1


def test_card_creation_daily_limit_enforced(client: TestClient) -> None:
    email = "limit@example.com"
    headers = register_and_login(client, email)
    status_id = create_status(client, headers)

    for index in range(DEFAULT_CARD_DAILY_LIMIT):
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
    assert limit_response.json()["detail"] == f"Daily card creation limit of {DEFAULT_CARD_DAILY_LIMIT} reached."


def test_status_and_label_scoping(client: TestClient) -> None:
    owner_headers = register_and_login(client, "owner-scope@example.com")
    status_response = client.post(
        "/statuses",
        json={"name": "Todo", "category": "todo", "order": 1},
        headers=owner_headers,
    )
    assert status_response.status_code == 201
    status_id = status_response.json()["id"]

    label_response = client.post(
        "/labels",
        json={"name": "Backend", "color": "#123456"},
        headers=owner_headers,
    )
    assert label_response.status_code == 201
    label_id = label_response.json()["id"]

    other_headers = register_and_login(client, "other-scope@example.com")

    status_list_other = client.get("/statuses", headers=other_headers)
    assert status_list_other.status_code == 200
    other_status_names = {status["name"] for status in status_list_other.json()}
    assert other_status_names == {"To Do", "Doing", "Done"}

    update_other = client.put(
        f"/statuses/{status_id}",
        json={"name": "Updated"},
        headers=other_headers,
    )
    assert update_other.status_code == 404

    label_list_other = client.get("/labels", headers=other_headers)
    assert label_list_other.status_code == 200
    assert label_list_other.json() == []

    delete_other = client.delete(f"/labels/{label_id}", headers=other_headers)
    assert delete_other.status_code == 404

    status_list_owner = client.get("/statuses", headers=owner_headers)
    assert status_list_owner.status_code == 200
    owner_status_names = {status["name"] for status in status_list_owner.json()}
    assert {"To Do", "Doing", "Done"}.issubset(owner_status_names)
    assert "Todo" in owner_status_names

    label_list_owner = client.get("/labels", headers=owner_headers)
    assert label_list_owner.status_code == 200
    assert len(label_list_owner.json()) == 1


def test_error_categories_are_user_scoped(client: TestClient) -> None:
    owner_headers = register_and_login(client, "error-owner@example.com")
    create_response = client.post(
        "/error-categories",
        json={"name": "Bug", "description": "Unexpected issue"},
        headers=owner_headers,
    )
    assert create_response.status_code == 201
    category_id = create_response.json()["id"]

    other_headers = register_and_login(client, "error-other@example.com")

    list_other = client.get("/error-categories", headers=other_headers)
    assert list_other.status_code == 200
    assert list_other.json() == []

    update_other = client.patch(
        f"/error-categories/{category_id}",
        json={"description": "Updated"},
        headers=other_headers,
    )
    assert update_other.status_code == 404

    delete_other = client.delete(
        f"/error-categories/{category_id}",
        headers=other_headers,
    )
    assert delete_other.status_code == 404

    list_owner = client.get("/error-categories", headers=owner_headers)
    assert list_owner.status_code == 200
    assert len(list_owner.json()) == 1


def test_board_layouts_are_user_specific(client: TestClient) -> None:
    headers_a = register_and_login(client, "layout-a@example.com")
    initial_a = client.get("/board-layouts", headers=headers_a)
    assert initial_a.status_code == 200
    assert initial_a.json()["user_id"]

    update_a = client.put(
        "/board-layouts",
        json={"board_grouping": "status", "visible_fields": ["title", "status"]},
        headers=headers_a,
    )
    assert update_a.status_code == 200
    assert update_a.json()["board_grouping"] == "status"

    headers_b = register_and_login(client, "layout-b@example.com")
    initial_b = client.get("/board-layouts", headers=headers_b)
    assert initial_b.status_code == 200
    assert initial_b.json()["board_grouping"] is None

    list_filters_a = client.get("/filters", headers=headers_a)
    assert list_filters_a.status_code == 200
    assert list_filters_a.json() == []

    create_filter = client.post(
        "/filters",
        json={"name": "My filter", "definition": {"priority": "high"}},
        headers=headers_a,
    )
    assert create_filter.status_code == 201
    filter_id = create_filter.json()["id"]

    list_filters_b = client.get("/filters", headers=headers_b)
    assert list_filters_b.status_code == 200
    assert list_filters_b.json() == []

    get_filter_b = client.get(f"/filters/{filter_id}", headers=headers_b)
    assert get_filter_b.status_code == 404
