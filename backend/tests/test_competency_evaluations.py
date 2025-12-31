from unittest import TestCase

from fastapi.testclient import TestClient

from app.utils.quotas import DEFAULT_EVALUATION_DAILY_LIMIT
from app.main import app
from app.services.gemini import get_optional_gemini_client

from .utils.auth import register_user

assertions = TestCase()


def _register(client: TestClient, email: str) -> dict[str, str]:
    payload = register_user(client, email=email, password="Password123!", nickname="Member")
    token = payload["access_token"]
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
    assertions.assertTrue(response.status_code == 201, response.text)
    return response.json()["id"]


def test_user_can_trigger_evaluation_and_view_quota(client: TestClient) -> None:
    admin_headers = _register(client, "admin@example.com")
    competency_id = _create_competency(client, admin_headers)

    user_headers = _register(client, "member@example.com")

    quota_response = client.get("/users/me/evaluations/quota", headers=user_headers)
    assertions.assertTrue(quota_response.status_code == 200)
    quota_payload = quota_response.json()

    assertions.assertTrue(quota_payload["daily_limit"] == DEFAULT_EVALUATION_DAILY_LIMIT)
    assertions.assertTrue(quota_payload["used"] == 0)
    if quota_payload["daily_limit"] > 0:
        assertions.assertTrue(quota_payload["remaining"] == DEFAULT_EVALUATION_DAILY_LIMIT)
    else:
        assertions.assertTrue(quota_payload["remaining"] is None)

    evaluation_response = client.post(
        "/users/me/evaluations",
        json={"competency_id": competency_id},
        headers=user_headers,
    )
    assertions.assertTrue(evaluation_response.status_code == 200, evaluation_response.text)
    evaluation_data = evaluation_response.json()

    assertions.assertTrue(evaluation_data["competency_id"] == competency_id)
    assertions.assertTrue(evaluation_data["user_id"] != "")
    assertions.assertTrue(evaluation_data["items"] != [])

    history_response = client.get("/users/me/evaluations", headers=user_headers)
    assertions.assertTrue(history_response.status_code == 200)
    history = history_response.json()
    assertions.assertTrue(any(item["id"] == evaluation_data["id"] for item in history))

    updated_quota = client.get("/users/me/evaluations/quota", headers=user_headers)
    assertions.assertTrue(updated_quota.status_code == 200)
    updated_payload = updated_quota.json()
    assertions.assertTrue(updated_payload["used"] == 1)
    if updated_payload["daily_limit"] > 0:
        assertions.assertTrue(updated_payload["remaining"] == DEFAULT_EVALUATION_DAILY_LIMIT - 1)
    else:
        assertions.assertTrue(updated_payload["remaining"] is None)

    if DEFAULT_EVALUATION_DAILY_LIMIT > 0:
        for _ in range(DEFAULT_EVALUATION_DAILY_LIMIT - 1):
            response = client.post(
                "/users/me/evaluations",
                json={"competency_id": competency_id},
                headers=user_headers,
            )
            assertions.assertTrue(response.status_code == 200, response.text)

        final_attempt = client.post(
            "/users/me/evaluations",
            json={"competency_id": competency_id},
            headers=user_headers,
        )
        assertions.assertTrue(final_attempt.status_code == 429)
        assertions.assertTrue("limit" in final_attempt.json()["detail"])


def test_user_can_list_competencies_and_trigger_batch_evaluations(client: TestClient) -> None:
    admin_headers = _register(client, "admin@example.com")
    competency_id_one = _create_competency(client, admin_headers)
    competency_id_two = _create_competency(client, admin_headers)

    user_headers = _register(client, "member@example.com")

    list_response = client.get("/users/me/competencies", headers=user_headers)
    assertions.assertTrue(list_response.status_code == 200, list_response.text)
    competencies = list_response.json()
    competency_ids = {item["id"] for item in competencies}
    assertions.assertTrue(competency_id_one in competency_ids)
    assertions.assertTrue(competency_id_two in competency_ids)

    batch_response = client.post(
        "/users/me/evaluations/batch",
        json={"competency_ids": [competency_id_one, competency_id_two]},
        headers=user_headers,
    )
    assertions.assertTrue(batch_response.status_code == 200, batch_response.text)
    evaluations = batch_response.json()
    assertions.assertTrue(len(evaluations) == 2)
    returned_ids = {item["competency_id"] for item in evaluations}
    assertions.assertTrue(returned_ids == {competency_id_one, competency_id_two})

    quota_response = client.get("/users/me/evaluations/quota", headers=user_headers)
    assertions.assertTrue(quota_response.status_code == 200, quota_response.text)
    quota_payload = quota_response.json()
    assertions.assertTrue(quota_payload["used"] == 1)

    if DEFAULT_EVALUATION_DAILY_LIMIT > 0:
        remaining = quota_payload.get("remaining")
        assertions.assertTrue(remaining == DEFAULT_EVALUATION_DAILY_LIMIT - 1)

        for _ in range(DEFAULT_EVALUATION_DAILY_LIMIT - 1):
            response = client.post(
                "/users/me/evaluations/batch",
                json={"competency_ids": [competency_id_one, competency_id_two]},
                headers=user_headers,
            )
            assertions.assertTrue(response.status_code == 200, response.text)

        final_attempt = client.post(
            "/users/me/evaluations/batch",
            json={"competency_ids": [competency_id_one, competency_id_two]},
            headers=user_headers,
        )
        assertions.assertTrue(final_attempt.status_code == 429, final_attempt.text)


def test_batch_evaluation_calls_external_ai_once(client: TestClient) -> None:
    class StubGemini:
        def __init__(self) -> None:
            self.calls = 0
            self.competency_ids: list[str] = []

        def generate_structured(  # type: ignore[override]
            self,
            *,
            prompt: str,
            response_schema: dict,
            system_prompt: str | None = None,
            model_override: str | None = None,
        ) -> dict:
            self.calls += 1
            return {
                "model": "stub-gemini",
                "evaluations": [
                    {
                        "competency_id": competency_id,
                        "score_value": 3,
                        "score_label": "標準",
                        "rationale": "スタブ評価です。",
                        "attitude_actions": ["姿勢アクション1", "姿勢アクション2"],
                        "behavior_actions": ["行動アクション1", "行動アクション2"],
                    }
                    for competency_id in self.competency_ids
                ],
            }

    stub = StubGemini()
    app.dependency_overrides[get_optional_gemini_client] = lambda: stub

    try:
        admin_headers = _register(client, "admin@example.com")
        competency_id_one = _create_competency(client, admin_headers)
        competency_id_two = _create_competency(client, admin_headers)
        stub.competency_ids = [competency_id_one, competency_id_two]

        user_headers = _register(client, "member@example.com")

        batch_response = client.post(
            "/users/me/evaluations/batch",
            json={"competency_ids": [competency_id_one, competency_id_two]},
            headers=user_headers,
        )
        assertions.assertTrue(batch_response.status_code == 200, batch_response.text)
        evaluations = batch_response.json()
        assertions.assertTrue(len(evaluations) == 2)
        assertions.assertTrue(stub.calls == 1)
        assertions.assertTrue(all(item.get("ai_model") == "stub-gemini" for item in evaluations))

        quota_response = client.get("/users/me/evaluations/quota", headers=user_headers)
        assertions.assertTrue(quota_response.status_code == 200, quota_response.text)
        quota_payload = quota_response.json()
        assertions.assertTrue(quota_payload["used"] == 1)
    finally:
        app.dependency_overrides.pop(get_optional_gemini_client, None)
