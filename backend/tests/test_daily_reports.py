from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from app import schemas
from app.main import app
from app.services.chatgpt import ChatGPTError, get_chatgpt_client

DEFAULT_PASSWORD = "Register123!"


def register_and_login(client: TestClient, email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class StubChatGPT:
    def analyze(self, request: schemas.AnalysisRequest) -> schemas.AnalysisResponse:
        return schemas.AnalysisResponse(
            model="stub-model",
            proposals=[
                schemas.AnalysisCard(
                    title="フォローアップタスクを準備",
                    summary="日報の重要事項を整理して改善案をまとめる",
                    priority="high",
                    due_in_days=1,
                    subtasks=[
                        schemas.AnalysisSubtask(
                            title="MTG で共有",
                            description="次回定例で共有する",
                        )
                    ],
                )
            ],
        )


class FailingThenSucceedingChatGPT:
    def __init__(self) -> None:
        self.call_count = 0

    def analyze(self, request: schemas.AnalysisRequest) -> schemas.AnalysisResponse:
        self.call_count += 1
        if self.call_count == 1:
            raise ChatGPTError("Temporary analysis failure")
        return schemas.AnalysisResponse(
            model="stub-model",
            proposals=[
                schemas.AnalysisCard(
                    title="フォローアップタスク (再解析)",
                    summary="再解析後の提案", 
                    priority="medium",
                    due_in_days=None,
                    subtasks=[],
                )
            ],
        )


def _daily_report_payload(report_date: date) -> dict:
    return {
        "report_date": report_date.isoformat(),
        "shift_type": "remote",
        "tags": ["backend", "daily"],
        "sections": [
            {"title": "対応内容", "body": "バッチ監視のアラート設定を調整し、テストを追加。"},
            {"title": "課題", "body": "顧客向けダッシュボードのレスポンス改善が必要。"},
        ],
    }


def test_create_and_list_daily_reports(client: TestClient) -> None:
    headers = register_and_login(client, "daily@example.com")

    create_response = client.post(
        "/daily-reports",
        json=_daily_report_payload(date(2024, 4, 1)),
        headers=headers,
    )
    assert create_response.status_code == 201, create_response.text
    data = create_response.json()
    assert data["status"] == "draft"
    assert data["report_date"] == "2024-04-01"

    list_response = client.get("/daily-reports", headers=headers)
    assert list_response.status_code == 200
    items = list_response.json()
    assert len(items) == 1
    assert items[0]["status"] == "draft"
    assert items[0]["card_count"] == 0
    assert items[0]["proposal_count"] == 0


def test_submit_daily_report_returns_proposals(client: TestClient) -> None:
    headers = register_and_login(client, "analysis@example.com")

    create_response = client.post(
        "/daily-reports",
        json=_daily_report_payload(date(2024, 4, 2)),
        headers=headers,
    )
    report_id = create_response.json()["id"]

    app.dependency_overrides[get_chatgpt_client] = lambda: StubChatGPT()
    try:
        submit_response = client.post(f"/daily-reports/{report_id}/submit", headers=headers)
    finally:
        app.dependency_overrides.pop(get_chatgpt_client, None)

    assert submit_response.status_code == 200, submit_response.text
    detail = submit_response.json()
    assert detail["status"] == "completed"
    assert detail["cards"] == []
    assert len(detail["pending_proposals"]) == 1
    assert detail["pending_proposals"][0]["title"].startswith("フォローアップタスク")

    list_response = client.get("/daily-reports", headers=headers)
    list_response.raise_for_status()
    assert list_response.json() == []

    get_response = client.get(f"/daily-reports/{report_id}", headers=headers)
    assert get_response.status_code == 404


def test_retry_daily_report_after_failure_succeeds(client: TestClient) -> None:
    headers = register_and_login(client, "retry@example.com")

    create_response = client.post(
        "/daily-reports",
        json=_daily_report_payload(date(2024, 4, 3)),
        headers=headers,
    )
    report_id = create_response.json()["id"]

    stub = FailingThenSucceedingChatGPT()
    app.dependency_overrides[get_chatgpt_client] = lambda: stub
    try:
        first_response = client.post(f"/daily-reports/{report_id}/submit", headers=headers)
        assert first_response.status_code == 200, first_response.text
        first_detail = first_response.json()
        assert first_detail["status"] == "failed"
        assert first_detail["failure_reason"] == "Temporary analysis failure"

        retry_response = client.post(f"/daily-reports/{report_id}/retry", headers=headers)
        assert retry_response.status_code == 200, retry_response.text
        retry_detail = retry_response.json()
    finally:
        app.dependency_overrides.pop(get_chatgpt_client, None)

    assert retry_detail["status"] == "completed"
    assert retry_detail["cards"] == []
    assert len(retry_detail["pending_proposals"]) == 1
    assert retry_detail["pending_proposals"][0]["title"].startswith("フォローアップタスク")
    assert stub.call_count == 2

    event_types = {event["event_type"] for event in retry_detail["events"]}
    assert "analysis_failed" in event_types
    assert "analysis_completed" in event_types

    list_response = client.get("/daily-reports", headers=headers)
    list_response.raise_for_status()
    assert list_response.json() == []

    get_response = client.get(f"/daily-reports/{report_id}", headers=headers)
    assert get_response.status_code == 404
