import hashlib
from unittest import TestCase

import pytest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app import models
from app.auth import hash_password
from app.config import Settings, settings
from app.database import get_db
from app.main import app

from .utils.auth import register_user

assertions = TestCase()


def _register_user(client: TestClient, email: str, password: str) -> dict:
    return register_user(client, email=email, password=password, nickname="User")


def _bootstrap_admin_and_member(client: TestClient) -> tuple[dict, dict]:
    password = "SecurePass123!"  # noqa: S105
    admin_payload = _register_user(client, "admin@example.com", password)
    member_payload = _register_user(client, "member@example.com", password)
    return admin_payload, member_payload


def test_cors_configuration_disallows_wildcard_credentials() -> None:
    cors_middleware = next(
        (middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware),
        None,
    )
    assertions.assertTrue(cors_middleware is not None, "CORS middleware should be registered")

    allow_origins = cors_middleware.kwargs.get("allow_origins")
    assertions.assertTrue(isinstance(allow_origins, (list, tuple)))
    assertions.assertTrue("*" not in allow_origins)
    assertions.assertTrue(allow_origins == settings.allowed_origins)
    assertions.assertTrue(cors_middleware.kwargs.get("allow_all_origins") in (None, False))


def test_settings_accepts_wildcard_origins() -> None:
    custom_settings = Settings(allowed_origins="*")
    assertions.assertTrue(custom_settings.allowed_origins == ["*"])


def test_settings_split_comma_separated_origins() -> None:
    custom_settings = Settings(allowed_origins="http://a.example,http://b.example")
    assertions.assertTrue(
        custom_settings.allowed_origins
        == [
            "http://a.example",
            "http://b.example",
        ]
    )


def test_email_login_flow_accepts_user_input_variations(client: TestClient) -> None:
    email_input = " Ｔｅｓｔ.User+1@Example.Com "  # noqa: RUF001
    password = "SecurePass123!"  # noqa: S105

    register_payload = register_user(
        client, email=email_input, password=password, nickname="Admin"
    )
    assertions.assertTrue(register_payload["user"]["email"] == "test.user+1@example.com")
    assertions.assertTrue(register_payload["user"]["is_admin"] is True)

    login_response = client.post(
        "/auth/login",
        json={"email": email_input, "password": password},
    )
    assertions.assertTrue(login_response.status_code == 200, login_response.text)
    login_payload = login_response.json()
    assertions.assertTrue(login_payload["user"]["email"] == "test.user+1@example.com")
    assertions.assertTrue(login_payload["user"]["is_admin"] is True)


def test_second_registered_user_is_inactive_until_admin_approval(client: TestClient) -> None:
    admin_email = "owner@example.com"
    member_email = "member@example.com"
    password = "SecurePass123!"  # noqa: S105

    first_register = client.post(
        "/auth/register",
        json={"email": admin_email, "password": password, "nickname": "Owner"},
    )
    assertions.assertTrue(first_register.status_code == 201, first_register.text)

    login_admin = client.post("/auth/login", json={"email": admin_email, "password": password})
    assertions.assertTrue(login_admin.status_code == 200, login_admin.text)
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    second_register = client.post(
        "/auth/register",
        json={"email": member_email, "password": password, "nickname": "Member"},
    )
    assertions.assertTrue(second_register.status_code == 201, second_register.text)

    login_member = client.post("/auth/login", json={"email": member_email, "password": password})
    assertions.assertTrue(login_member.status_code == 403, login_member.text)

    users_response = client.get("/admin/users", headers=admin_headers)
    assertions.assertTrue(users_response.status_code == 200, users_response.text)
    member_row = next((user for user in users_response.json() if user.get("email") == member_email), None)
    assertions.assertTrue(member_row is not None, users_response.json())
    assertions.assertTrue(member_row["is_admin"] is False)
    assertions.assertTrue(member_row["is_active"] is False)


def test_admin_contact_returns_first_admin_email(client: TestClient) -> None:
    response = client.get("/auth/admin-contact")
    assertions.assertTrue(response.status_code == 200, response.text)
    assertions.assertTrue(response.json()["email"] is None)

    password = "SecurePass123!"  # noqa: S105
    first = client.post(
        "/auth/register",
        json={"email": "owner@example.com", "password": password, "nickname": "Owner"},
    )
    assertions.assertTrue(first.status_code == 201, first.text)

    response = client.get("/auth/admin-contact")
    assertions.assertTrue(response.status_code == 200, response.text)
    assertions.assertTrue(response.json()["email"] == "owner@example.com")

    login_admin = client.post("/auth/login", json={"email": "owner@example.com", "password": password})
    assertions.assertTrue(login_admin.status_code == 200, login_admin.text)
    admin_headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    second = client.post(
        "/auth/register",
        json={"email": "second@example.com", "password": password, "nickname": "Second"},
    )
    assertions.assertTrue(second.status_code == 201, second.text)

    users_response = client.get("/admin/users", headers=admin_headers)
    assertions.assertTrue(users_response.status_code == 200, users_response.text)
    second_row = next((user for user in users_response.json() if user.get("email") == "second@example.com"), None)
    assertions.assertTrue(second_row is not None, users_response.json())

    promote = client.patch(
        f"/admin/users/{second_row['id']}",
        json={"is_admin": True, "is_active": True},
        headers=admin_headers,
    )
    assertions.assertTrue(promote.status_code == 200, promote.text)

    response = client.get("/auth/admin-contact")
    assertions.assertTrue(response.status_code == 200, response.text)
    assertions.assertTrue(response.json()["email"] == "owner@example.com")


def test_login_allows_legacy_normalized_emails(client: TestClient) -> None:
    login_input = "Straße@Example.com"
    stored_email = login_input.strip().lower()
    password = "SecurePass123!"  # noqa: S105

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
    assertions.assertTrue(login_response.status_code == 200, login_response.text)
    login_payload = login_response.json()
    assertions.assertTrue(login_payload["user"]["email"] == stored_email)


def test_session_tokens_are_hashed(client: TestClient) -> None:
    payload = _register_user(client, "secure@example.com", "StrongPass123!")
    access_token = payload["access_token"]

    override = client.app.dependency_overrides[get_db]
    db_gen = override()
    db = next(db_gen)
    try:
        stored_tokens = db.query(models.SessionToken).all()
    finally:
        db_gen.close()

    assertions.assertTrue(stored_tokens, "Session token should be stored")
    stored_token = stored_tokens[0]
    expected_hash = hashlib.sha256(access_token.encode("utf-8")).hexdigest()
    assertions.assertTrue(stored_token.token == expected_hash)


def test_analytics_routes_require_admin(client: TestClient) -> None:
    admin_payload, member_payload = _bootstrap_admin_and_member(client)
    admin_token = admin_payload["access_token"]
    member_token = member_payload["access_token"]

    unauthenticated = client.get("/analytics/snapshots")
    assertions.assertTrue(unauthenticated.status_code == 401)

    forbidden = client.get(
        "/analytics/snapshots",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assertions.assertTrue(forbidden.status_code == 403)

    allowed = client.get(
        "/analytics/snapshots",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assertions.assertTrue(allowed.status_code == 200, allowed.text)
    assertions.assertTrue(isinstance(allowed.json(), list))


def test_reports_routes_require_admin(client: TestClient) -> None:
    admin_payload, member_payload = _bootstrap_admin_and_member(client)
    admin_token = admin_payload["access_token"]
    member_token = member_payload["access_token"]

    unauthenticated = client.get("/reports/templates")
    assertions.assertTrue(unauthenticated.status_code == 401)

    forbidden = client.get(
        "/reports/templates",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assertions.assertTrue(forbidden.status_code == 403)

    allowed = client.get(
        "/reports/templates",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assertions.assertTrue(allowed.status_code == 200, allowed.text)
    assertions.assertTrue(isinstance(allowed.json(), list))

    forbidden_generate = client.post(
        "/reports/generate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"parameters": {}},
    )
    assertions.assertTrue(forbidden_generate.status_code == 403)


def test_generate_report_sets_author_to_authenticated_admin(client: TestClient) -> None:
    admin_payload, _ = _bootstrap_admin_and_member(client)
    admin_token = admin_payload["access_token"]

    response = client.post(
        "/reports/generate",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "author_id": "spoofed-user",
            "parameters": {"title": "Security Review"},
        },
    )
    assertions.assertTrue(response.status_code == 201, response.text)
    data = response.json()
    assertions.assertTrue(data["author_id"] == admin_payload["user"]["id"])
