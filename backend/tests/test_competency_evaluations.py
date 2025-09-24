from fastapi.testclient import TestClient

from app.utils.quotas import DEFAULT_EVALUATION_DAILY_LIMIT


def _register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "Password123!"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_competency(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/admin/competencies",
        json={
            "name": "チームワーク基礎",
            "level": "junior",
            "description": "テスト用コンピテンシー",
            "rubric": {},
            "sort_order": 1,
            "is_active": True,
            "criteria": [],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_user_can_trigger_evaluation_and_view_quota(client: TestClient) -> None:
    admin_headers = _register(client, "admin@example.com")
    competency_id = _create_competency(client, admin_headers)

    user_headers = _register(client, "member@example.com")

    quota_response = client.get("/users/me/evaluations/quota", headers=user_headers)
    assert quota_response.status_code == 200
    quota_payload = quota_response.json()

    assert quota_payload["daily_limit"] == DEFAULT_EVALUATION_DAILY_LIMIT
    assert quota_payload["used"] == 0
    if quota_payload["daily_limit"] > 0:
        assert quota_payload["remaining"] == DEFAULT_EVALUATION_DAILY_LIMIT
    else:
        assert quota_payload["remaining"] is None

    evaluation_response = client.post(
        "/users/me/evaluations",
        json={"competency_id": competency_id},
        headers=user_headers,
    )
    assert evaluation_response.status_code == 200, evaluation_response.text
    evaluation_data = evaluation_response.json()

    assert evaluation_data["competency_id"] == competency_id
    assert evaluation_data["user_id"] != ""
    assert evaluation_data["items"] != []

    history_response = client.get("/users/me/evaluations", headers=user_headers)
    assert history_response.status_code == 200
    history = history_response.json()
    assert any(item["id"] == evaluation_data["id"] for item in history)

    updated_quota = client.get("/users/me/evaluations/quota", headers=user_headers)
    assert updated_quota.status_code == 200
    updated_payload = updated_quota.json()
    assert updated_payload["used"] == 1
    if updated_payload["daily_limit"] > 0:
        assert updated_payload["remaining"] == DEFAULT_EVALUATION_DAILY_LIMIT - 1
    else:
        assert updated_payload["remaining"] is None

    if DEFAULT_EVALUATION_DAILY_LIMIT > 0:
        for _ in range(DEFAULT_EVALUATION_DAILY_LIMIT - 1):
            response = client.post(
                "/users/me/evaluations",
                json={"competency_id": competency_id},
                headers=user_headers,
            )
            assert response.status_code == 200, response.text

        final_attempt = client.post(
            "/users/me/evaluations",
            json={"competency_id": competency_id},
            headers=user_headers,
        )
        assert final_attempt.status_code == 429
        assert "limit" in final_attempt.json()["detail"]

