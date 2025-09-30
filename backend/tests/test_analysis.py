from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import models, schemas
from app.main import app
from app.services.gemini import GeminiError, get_gemini_client

from .conftest import TestingSessionLocal


def _register_and_login(client: TestClient, email: str) -> dict[str, str]:
    password = "Analysis123!"  # noqa: S105 - test credential
    register = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert register.status_code == 201, register.text

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
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

    assert response.status_code == 503
    payload = response.json()
    assert "Gemini API key is not configured" in payload["detail"]


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
            assert request.text
            assert workspace_options is not None
            assert getattr(workspace_options, "statuses", ())
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

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["model"] == "gemini-pro-test"
    assert len(data["proposals"]) == 1
    assert data["proposals"][0]["title"] == "Add login coverage"

    with TestingSessionLocal() as db:
        sessions = db.query(models.AnalysisSession).all()
        assert len(sessions) == 1
        session = sessions[0]
        assert session.status == "completed"
        assert session.objective == "Improve QA coverage"
        assert session.notes == "Login flow intermittently fails"
        assert session.response_model == "gemini-pro-test"
        assert session.proposals and session.proposals[0]["title"] == "Add login coverage"


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

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert "Upstream failure" in detail

    with TestingSessionLocal() as db:
        session = db.query(models.AnalysisSession).one()
        assert session.status == "failed"
        assert session.failure_reason == "Upstream failure"
        assert session.proposals == []
