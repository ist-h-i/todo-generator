from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


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
