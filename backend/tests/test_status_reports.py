from __future__ import annotations

from unittest import TestCase

from fastapi.testclient import TestClient

from app import models, schemas
from app.main import app
from app.services.gemini import get_gemini_client

from .conftest import TestingSessionLocal
from .utils.auth import register_user

assertions = TestCase()


def _register_and_login(client: TestClient, email: str) -> dict[str, str]:
    password = "StatusReport123!"  # noqa: S105 - test credential
    register_user(client, email=email, password=password, nickname="Reporter")

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assertions.assertEqual(login.status_code, 200, login.text)
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_status_report_submit_retains_record(client: TestClient) -> None:
    headers = _register_and_login(client, "status-report-retain@example.com")
    create_payload = {
        "shift_type": None,
        "tags": ["daily"],
        "sections": [{"title": "Summary", "body": "Completed onboarding tasks."}],
        "auto_ticket_enabled": False,
    }
    created = client.post("/status-reports", json=create_payload, headers=headers)
    assertions.assertEqual(created.status_code, 201, created.text)
    report_id = created.json()["id"]

    response_payload = schemas.AnalysisResponse(
        model="gemini-pro-test",
        proposals=[
            schemas.AnalysisCard(
                title="Plan onboarding follow-up",
                summary="Schedule a quick sync and share notes.",
                status="todo",
                labels=["onboarding"],
                priority="medium",
                due_in_days=3,
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
    try:
        submitted = client.post(f"/status-reports/{report_id}/submit", headers=headers)
    finally:
        app.dependency_overrides.pop(get_gemini_client, None)

    assertions.assertEqual(submitted.status_code, 200, submitted.text)

    with TestingSessionLocal() as db:
        report = db.query(models.StatusReport).filter(models.StatusReport.id == report_id).one_or_none()
        assertions.assertIsNotNone(report)
        assertions.assertEqual(report.status, schemas.StatusReportStatus.COMPLETED.value)
