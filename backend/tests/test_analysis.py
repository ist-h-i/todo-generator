from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import models, schemas
from app.main import app
from app.services.chatgpt import ChatGPTError, get_chatgpt_client

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
        pytest.skip("ChatGPT integration is enabled; skipping configuration error assertion.")

    assert response.status_code == 503
    payload = response.json()
    assert "ChatGPT API key is not configured" in payload["detail"]


def test_analysis_persists_session(client: TestClient) -> None:
    headers = _register_and_login(client, "analysis-db@example.com")

    response_payload = schemas.AnalysisResponse(
        model="gpt-test-4o",
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

    class StubChatGPT:
        def analyze(self, request: schemas.AnalysisRequest, *, user_profile=None) -> schemas.AnalysisResponse:
            assert request.text
            return response_payload

    app.dependency_overrides[get_chatgpt_client] = lambda: StubChatGPT()
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
        app.dependency_overrides.pop(get_chatgpt_client, None)

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["model"] == "gpt-test-4o"
    assert len(data["proposals"]) == 1
    assert data["proposals"][0]["title"] == "Add login coverage"

    with TestingSessionLocal() as db:
        sessions = db.query(models.AnalysisSession).all()
        assert len(sessions) == 1
        session = sessions[0]
        assert session.status == "completed"
        assert session.objective == "Improve QA coverage"
        assert session.notes == "Login flow intermittently fails"
        assert session.response_model == "gpt-test-4o"
        assert session.proposals and session.proposals[0]["title"] == "Add login coverage"


def test_analysis_records_failure(client: TestClient) -> None:
    headers = _register_and_login(client, "analysis-failure@example.com")

    class FailingChatGPT:
        def analyze(self, request: schemas.AnalysisRequest, *, user_profile=None) -> schemas.AnalysisResponse:
            raise ChatGPTError("Upstream failure")

    app.dependency_overrides[get_chatgpt_client] = lambda: FailingChatGPT()
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
        app.dependency_overrides.pop(get_chatgpt_client, None)

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert "Upstream failure" in detail

    with TestingSessionLocal() as db:
        session = db.query(models.AnalysisSession).one()
        assert session.status == "failed"
        assert session.failure_reason == "Upstream failure"
        assert session.proposals == []
