"""Test helpers for authentication flows."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import models
from app.auth import normalize_email

from ..conftest import TestingSessionLocal

def login_user(client: TestClient, *, email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def register_user(
    client: TestClient,
    *,
    email: str,
    password: str,
    nickname: str = "Tester",
    activate: bool = True,
) -> dict:
    response = client.post("/auth/register", json={"email": email, "password": password, "nickname": nickname})
    assert response.status_code == 201, response.text

    if activate:
        with TestingSessionLocal() as db:
            normalized = normalize_email(email)
            user = db.query(models.User).filter(models.User.email == normalized).first()
            assert user is not None, f"registered user not found: {email}"
            user.is_active = True
            db.add(user)
            db.commit()

    return login_user(client, email=email, password=password)

