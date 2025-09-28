from __future__ import annotations

from fastapi.testclient import TestClient


def _admin_headers(client: TestClient) -> dict[str, str]:
    email = "owner@example.com"
    password = "AdminPass123!"  # noqa: S105 - test credential

    register = client.post("/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201, register.text

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_update_gemini_model_without_rotating_secret(client: TestClient) -> None:
    headers = _admin_headers(client)

    create = client.put(
        "/admin/api-credentials/gemini",
        headers=headers,
        json={"secret": "sk-original", "model": "gemini-1.5-pro"},
    )
    assert create.status_code == 200, create.text
    created_payload = create.json()
    assert created_payload["model"] == "gemini-1.5-pro"
    assert created_payload["secret_hint"]

    update = client.put(
        "/admin/api-credentials/gemini",
        headers=headers,
        json={"model": "gemini-1.5-flash"},
    )
    assert update.status_code == 200, update.text
    updated_payload = update.json()
    assert updated_payload["model"] == "gemini-1.5-flash"
    assert updated_payload["secret_hint"] == created_payload["secret_hint"]

    fetch = client.get("/admin/api-credentials/gemini", headers=headers)
    assert fetch.status_code == 200, fetch.text
    fetched_payload = fetch.json()
    assert fetched_payload["model"] == "gemini-1.5-flash"


def test_admin_cannot_create_credential_without_secret(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.put(
        "/admin/api-credentials/gemini",
        headers=headers,
        json={"model": "gemini-1.5-pro"},
    )
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "API トークンを入力してください。"
