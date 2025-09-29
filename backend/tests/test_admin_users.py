from __future__ import annotations

from fastapi.testclient import TestClient

from app import models

from .conftest import TestingSessionLocal


def _create_admin(client: TestClient) -> tuple[dict[str, str], str]:
    email = "owner@example.com"
    password = "AdminPass123!"  # noqa: S105 - test credential

    register = client.post("/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201, register.text
    admin_id = register.json()["user"]["id"]

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, admin_id


def test_admin_can_delete_user(client: TestClient) -> None:
    headers, _ = _create_admin(client)

    user_register = client.post(
        "/auth/register",
        json={"email": "member@example.com", "password": "Password123!"},
    )
    assert user_register.status_code == 201, user_register.text
    user_id = user_register.json()["user"]["id"]

    before = client.get("/admin/users", headers=headers)
    assert before.status_code == 200, before.text
    before_ids = {user["id"] for user in before.json()}
    assert user_id in before_ids

    response = client.delete(f"/admin/users/{user_id}", headers=headers)
    assert response.status_code == 204, response.text

    after = client.get("/admin/users", headers=headers)
    assert after.status_code == 200, after.text
    after_ids = {user["id"] for user in after.json()}
    assert user_id not in after_ids


def test_admin_cannot_delete_self(client: TestClient) -> None:
    headers, admin_id = _create_admin(client)

    response = client.delete(f"/admin/users/{admin_id}", headers=headers)
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Cannot delete your own account."


def test_admin_can_delete_other_admin(client: TestClient) -> None:
    headers, admin_id = _create_admin(client)

    other_register = client.post(
        "/auth/register",
        json={"email": "second@example.com", "password": "Password123!"},
    )
    assert other_register.status_code == 201, other_register.text
    other_id = other_register.json()["user"]["id"]

    promote = client.patch(
        f"/admin/users/{other_id}",
        json={"is_admin": True},
        headers=headers,
    )
    assert promote.status_code == 200, promote.text
    assert promote.json()["is_admin"] is True

    response = client.delete(f"/admin/users/{other_id}", headers=headers)
    assert response.status_code == 204, response.text

    remaining = client.get("/admin/users", headers=headers)
    assert remaining.status_code == 200, remaining.text
    remaining_ids = {user["id"] for user in remaining.json()}
    assert admin_id in remaining_ids
    assert other_id not in remaining_ids


def test_deleting_admin_nulls_related_jobs(client: TestClient) -> None:
    headers, _ = _create_admin(client)

    member_register = client.post(
        "/auth/register",
        json={"email": "member@example.com", "password": "Password123!"},
    )
    assert member_register.status_code == 201, member_register.text
    member_id = member_register.json()["user"]["id"]

    competency_response = client.post(
        "/admin/competencies",
        headers=headers,
        json={
            "name": "Communication",
            "level": "junior",
            "description": "",
            "rubric": {},
            "sort_order": 1,
            "is_active": True,
            "criteria": [
                {
                    "title": "Clarity",
                    "description": "",
                    "weight": 1,
                    "intentionality_prompt": None,
                    "behavior_prompt": None,
                    "is_active": True,
                    "order_index": 0,
                }
            ],
        },
    )
    assert competency_response.status_code == 201, competency_response.text
    competency_id = competency_response.json()["id"]

    other_register = client.post(
        "/auth/register",
        json={"email": "second@example.com", "password": "Password123!"},
    )
    assert other_register.status_code == 201, other_register.text
    other_id = other_register.json()["user"]["id"]

    promote = client.patch(
        f"/admin/users/{other_id}",
        json={"is_admin": True},
        headers=headers,
    )
    assert promote.status_code == 200, promote.text

    other_login = client.post(
        "/auth/login",
        json={"email": "second@example.com", "password": "Password123!"},
    )
    assert other_login.status_code == 200, other_login.text
    other_token = other_login.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    evaluation = client.post(
        f"/admin/competencies/{competency_id}/evaluate",
        headers=other_headers,
        json={"user_id": member_id, "triggered_by": "manual"},
    )
    assert evaluation.status_code == 200, evaluation.text

    response = client.delete(f"/admin/users/{other_id}", headers=headers)
    assert response.status_code == 204, response.text

    with TestingSessionLocal() as db:
        jobs = db.query(models.CompetencyEvaluationJob).all()
        assert jobs, "expected competency evaluation job to exist"
        for job in jobs:
            assert job.triggered_by_id is None
            assert job.user_id != other_id


def test_admin_can_delete_admin_who_created_api_credentials(client: TestClient) -> None:
    headers, admin_id = _create_admin(client)

    other_register = client.post(
        "/auth/register",
        json={"email": "second@example.com", "password": "Password123!"},
    )
    assert other_register.status_code == 201, other_register.text
    other_id = other_register.json()["user"]["id"]

    promote = client.patch(
        f"/admin/users/{other_id}",
        json={"is_admin": True},
        headers=headers,
    )
    assert promote.status_code == 200, promote.text

    other_login = client.post(
        "/auth/login",
        json={"email": "second@example.com", "password": "Password123!"},
    )
    assert other_login.status_code == 200, other_login.text
    other_token = other_login.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    credential = client.put(
        "/admin/api-credentials/gemini",
        json={"secret": "sk-test", "model": "flash"},
        headers=other_headers,
    )
    assert credential.status_code == 200, credential.text

    with TestingSessionLocal() as db:
        stored_credentials = db.query(models.ApiCredential).all()
        assert stored_credentials, "expected API credential to be created"
        assert all(item.created_by_id == other_id for item in stored_credentials)

    response = client.delete(f"/admin/users/{other_id}", headers=headers)
    assert response.status_code == 204, response.text

    remaining = client.get("/admin/users", headers=headers)
    assert remaining.status_code == 200, remaining.text
    remaining_ids = {user["id"] for user in remaining.json()}
    assert admin_id in remaining_ids
    assert other_id not in remaining_ids

    with TestingSessionLocal() as db:
        stored_credentials = db.query(models.ApiCredential).all()
        assert stored_credentials, "expected API credential to persist"
        assert all(item.created_by_id is None for item in stored_credentials)
