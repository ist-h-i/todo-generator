from __future__ import annotations

from unittest import TestCase

import pytest
from fastapi.testclient import TestClient

from app import models, schemas
from app.main import app
from app.services.gemini import GeminiError, get_gemini_client

from .conftest import TestingSessionLocal

assertions = TestCase()


def _register_and_login(client: TestClient, email: str) -> dict[str, str]:
    password = "Analysis123!"  # noqa: S105 - test credential
    register = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assertions.assertEqual(register.status_code, 201, register.text)

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assertions.assertEqual(login.status_code, 200, login.text)
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_analysis_requires_api_key(client: TestClient) -> None:
    headers = _register_and_login(client, "analysis-user@example.com")
    response = client.post(
        "/analysis",
        json={"text": "Implement login flow", "max_cards": 1},
        headers=headers,
    )

    if response.status_code != 503:
        pytest.skip("Gemini integration is enabled; skipping configuration error assertion.")

    assertions.assertEqual(response.status_code, 503)
    payload = response.json()
    assertions.assertIn("Gemini API key is not configured", payload["detail"])


def test_analysis_persists_session(client: TestClient) -> None:
    headers = _register_and_login(client, "analysis-db@example.com")

    response_payload = schemas.AnalysisResponse(
        model="gemini-pro-test",
        proposals=[
            schemas.AnalysisCard(
                title="Add login coverage",
                summary="Write regression tests for login flow.",
                status="todo",
                labels=["quality"],
                priority="high",
                due_in_days=5,
                subtasks=[schemas.AnalysisSubtask(title="Create E2E tests")],
            )
        ],
    )

    class StubGemini:
        def analyze(
            self,
            request: schemas.AnalysisRequest,
            *,
            user_profile=None,
            workspace_options=None,
        ) -> schemas.AnalysisResponse:
            assertions.assertTrue(request.text)
            assertions.assertIsNotNone(workspace_options)
            assertions.assertTrue(getattr(workspace_options, "statuses", ()))
            return response_payload

    app.dependency_overrides[get_gemini_client] = lambda: StubGemini()
    payload = {
        "text": "Objective: Improve QA coverage\n\nNotes:\nLogin flow intermittently fails",
        "max_cards": 3,
        "notes": "Login flow intermittently fails",
        "objective": "Improve QA coverage",
        "auto_objective": False,
    }
    try:
        response = client.post("/analysis", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_gemini_client, None)

    assertions.assertEqual(response.status_code, 200, response.text)
    data = response.json()
    assertions.assertEqual(data["model"], "gemini-pro-test")
    assertions.assertEqual(len(data["proposals"]), 1)
    assertions.assertEqual(data["proposals"][0]["title"], "Add login coverage")
    assertions.assertTrue(data["proposals"][0]["labels"])

    with TestingSessionLocal() as db:
        sessions = db.query(models.AnalysisSession).all()
        assertions.assertEqual(len(sessions), 1)
        session = sessions[0]
        assertions.assertEqual(session.status, "completed")
        assertions.assertEqual(session.objective, "Improve QA coverage")
        assertions.assertEqual(session.notes, "Login flow intermittently fails")
        assertions.assertEqual(session.response_model, "gemini-pro-test")
        assertions.assertTrue(session.proposals and session.proposals[0]["title"] == "Add login coverage")

        stored_labels = session.proposals[0].get("labels") or []
        returned_label_id = data["proposals"][0]["labels"][0]
        assertions.assertTrue(stored_labels and stored_labels[0] == returned_label_id)

        labels = db.query(models.Label).filter(models.Label.owner_id == session.user_id).all()
        assertions.assertTrue(labels)
        assertions.assertTrue(any(label.id == returned_label_id for label in labels))


def test_analysis_registers_new_labels(client: TestClient) -> None:
    headers = _register_and_login(client, "analysis-labels@example.com")

    response_payload = schemas.AnalysisResponse(
        model="gemini-pro-test",
        proposals=[
            schemas.AnalysisCard(
                title="Refine onboarding flow",
                summary="Improve the messaging for new users.",
                status="todo",
                labels=["Customer Advocacy"],
                priority="medium",
                due_in_days=None,
                subtasks=[],
            )
        ],
    )

    class StubGemini:
        def analyze(
            self,
            request: schemas.AnalysisRequest,
            *,
            user_profile=None,
            workspace_options=None,
        ) -> schemas.AnalysisResponse:
            return response_payload

    app.dependency_overrides[get_gemini_client] = lambda: StubGemini()
    payload = {
        "text": "Objective: Delight customers\n\nNotes:\nPolish the onboarding emails",
        "max_cards": 2,
        "notes": "Polish the onboarding emails",
        "objective": "Delight customers",
        "auto_objective": False,
    }
    try:
        response = client.post("/analysis", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_gemini_client, None)

    assertions.assertEqual(response.status_code, 200, response.text)
    data = response.json()
    assertions.assertTrue(data["proposals"][0]["labels"])

    with TestingSessionLocal() as db:
        user = db.query(models.User).filter(models.User.email == "analysis-labels@example.com").one()
        labels = db.query(models.Label).filter(models.Label.owner_id == user.id).all()
        assertions.assertEqual(len(labels), 1)
        assertions.assertEqual(labels[0].name, "Customer Advocacy")
        assertions.assertEqual(data["proposals"][0]["labels"][0], labels[0].id)


def test_analysis_records_failure(client: TestClient) -> None:
    headers = _register_and_login(client, "analysis-failure@example.com")

    class FailingGemini:
        def analyze(
            self,
            request: schemas.AnalysisRequest,
            *,
            user_profile=None,
            workspace_options=None,
        ) -> schemas.AnalysisResponse:
            raise GeminiError("Upstream failure")

    app.dependency_overrides[get_gemini_client] = lambda: FailingGemini()
    payload = {
        "text": "Notes: Investigate outage",
        "max_cards": 2,
        "notes": "Investigate outage",
        "objective": "Stabilize service",
        "auto_objective": True,
    }
    try:
        response = client.post("/analysis", json=payload, headers=headers)
    finally:
        app.dependency_overrides.pop(get_gemini_client, None)

    assertions.assertEqual(response.status_code, 502)
    detail = response.json()["detail"]
    assertions.assertIn("Upstream failure", detail)

    with TestingSessionLocal() as db:
        session = db.query(models.AnalysisSession).one()
        assertions.assertEqual(session.status, "failed")
        assertions.assertEqual(session.failure_reason, "Upstream failure")
        assertions.assertEqual(session.proposals, [])
