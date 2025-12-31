from __future__ import annotations

from unittest import TestCase

from fastapi.testclient import TestClient

from app import models

from .conftest import TestingSessionLocal
from .utils.auth import register_user

assertions = TestCase()


def _create_admin(client: TestClient) -> dict[str, str]:
    email = "owner@example.com"
    password = "AdminPass123!"  # noqa: S105 - test credential

    register_payload = register_user(client, email=email, password=password, nickname="Owner")
    assertions.assertTrue(register_payload["user"]["is_admin"] is True)

    login = client.post("/auth/login", json={"email": email, "password": password})
    assertions.assertTrue(login.status_code == 200, login.text)
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_competency(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
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
    assertions.assertTrue(response.status_code == 201, response.text)
    return response.json()["id"]


def test_admin_can_delete_competency(client: TestClient) -> None:
    headers = _create_admin(client)
    competency_id = _create_competency(client, headers)

    before = client.get("/admin/competencies", headers=headers)
    assertions.assertTrue(before.status_code == 200, before.text)
    before_ids = {competency["id"] for competency in before.json()}
    assertions.assertTrue(competency_id in before_ids)

    response = client.delete(f"/admin/competencies/{competency_id}", headers=headers)
    assertions.assertTrue(response.status_code == 204, response.text)

    after = client.get("/admin/competencies", headers=headers)
    assertions.assertTrue(after.status_code == 200, after.text)
    after_ids = {competency["id"] for competency in after.json()}
    assertions.assertTrue(competency_id not in after_ids)

    missing = client.get(f"/admin/competencies/{competency_id}", headers=headers)
    assertions.assertTrue(missing.status_code == 404, missing.text)


def test_deleting_competency_nulls_related_jobs(client: TestClient) -> None:
    headers = _create_admin(client)
    competency_id = _create_competency(client, headers)

    with TestingSessionLocal() as db:
        job = models.CompetencyEvaluationJob(
            competency_id=competency_id,
            status="pending",
            scope="user",
            triggered_by="manual",
        )
        db.add(job)
        db.commit()
        job_id = job.id

    response = client.delete(f"/admin/competencies/{competency_id}", headers=headers)
    assertions.assertTrue(response.status_code == 204, response.text)

    with TestingSessionLocal() as db:
        stored_job = db.get(models.CompetencyEvaluationJob, job_id)
        assertions.assertTrue(stored_job is not None, "expected competency evaluation job to persist")
        assertions.assertTrue(stored_job.competency_id is None)

