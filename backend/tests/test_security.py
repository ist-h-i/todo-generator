import pytest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app import models
from app.auth import hash_password
from app.config import Settings, settings
from app.database import get_db
from app.main import app


def test_cors_configuration_disallows_wildcard_credentials() -> None:
    cors_middleware = next(
        (middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware),
        None,
    )
    assert cors_middleware is not None, "CORS middleware should be registered"

    allow_origins = cors_middleware.kwargs.get("allow_origins")
    assert isinstance(allow_origins, (list, tuple))
    assert "*" not in allow_origins
    assert allow_origins == settings.allowed_origins
    assert cors_middleware.kwargs.get("allow_all_origins") in (None, False)


def test_settings_reject_wildcard_origins() -> None:
    with pytest.raises(ValueError):
        Settings(allowed_origins="*")


def test_settings_split_comma_separated_origins() -> None:
    custom_settings = Settings(allowed_origins="http://a.example,http://b.example")
    assert custom_settings.allowed_origins == [
        "http://a.example",
        "http://b.example",
    ]


def test_email_login_flow_accepts_user_input_variations(client: TestClient) -> None:
    email_input = " Ｔｅｓｔ.User+1@Example.Com "
    password = "SecurePass123!"

    register_response = client.post(
        "/auth/register",
        json={"email": email_input, "password": password},
    )
    assert register_response.status_code == 201, register_response.text
    register_payload = register_response.json()
    assert register_payload["user"]["email"] == "test.user+1@example.com"

    login_response = client.post(
        "/auth/login",
        json={"email": email_input, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    login_payload = login_response.json()
    assert login_payload["user"]["email"] == "test.user+1@example.com"


def test_login_allows_legacy_normalized_emails(client: TestClient) -> None:
    login_input = "Straße@Example.com"
    stored_email = login_input.strip().lower()
    password = "SecurePass123!"

    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        user = models.User(email=stored_email, password_hash=hash_password(password))
        db.add(user)
        db.commit()
    finally:
        db_gen.close()

    login_response = client.post(
        "/auth/login",
        json={"email": login_input, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    login_payload = login_response.json()
    assert login_payload["user"]["email"] == stored_email
