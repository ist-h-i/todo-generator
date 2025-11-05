"""Test helpers for authentication flows."""

from __future__ import annotations

from fastapi.testclient import TestClient


def request_verification_code(client: TestClient, email: str) -> str:
    response = client.post("/auth/register/request-code", json={"email": email})
    assert response.status_code == 202, response.text
    payload = response.json()
    code = payload.get("verification_code")
    assert code, "Verification code was not returned in debug mode."
    return code


def register_user(
    client: TestClient,
    *,
    email: str,
    password: str,
    nickname: str = "Tester",
) -> dict:
    code = request_verification_code(client, email)
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "nickname": nickname,
            "verification_code": code,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()

