from __future__ import annotations

from fastapi.testclient import TestClient

from app import models
from app.utils.secrets import build_secret_hint, get_secret_cipher

from .conftest import TestingSessionLocal


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
    assert updated_payload["model"] == "models/gemini-1.5-flash"
    assert updated_payload["secret_hint"] == created_payload["secret_hint"]

    fetch = client.get("/admin/api-credentials/gemini", headers=headers)
    assert fetch.status_code == 200, fetch.text
    fetched_payload = fetch.json()
    assert fetched_payload["model"] == "models/gemini-1.5-flash"


def test_admin_credentials_use_default_secret_key(client: TestClient) -> None:
    headers = _admin_headers(client)
    secret = "sk-fallback-secret"  # noqa: S105 - test secret

    create = client.put(
        "/admin/api-credentials/gemini",
        headers=headers,
        json={"secret": secret, "model": "models/gemini-1.5-flash"},
    )
    assert create.status_code == 200, create.text

    with TestingSessionLocal() as db:
        credential = db.query(models.ApiCredential).filter(models.ApiCredential.provider == "gemini").one()

    cipher = get_secret_cipher()
    decrypted = cipher.decrypt(credential.encrypted_secret)
    assert decrypted.plaintext == secret
    assert decrypted.reencrypted_payload is None

    fetch = client.get("/admin/api-credentials/gemini", headers=headers)
    assert fetch.status_code == 200, fetch.text
    payload = fetch.json()
    assert payload["secret_hint"] == build_secret_hint(secret)


def test_admin_cannot_create_credential_without_secret(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.put(
        "/admin/api-credentials/gemini",
        headers=headers,
        json={"model": "gemini-1.5-pro"},
    )
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "API トークンを入力してください。"


def test_existing_gemini_credential_is_accessible_via_case_insensitive_alias(client: TestClient) -> None:
    headers = _admin_headers(client)

    with TestingSessionLocal() as db:
        user = db.query(models.User).filter(models.User.email == "owner@example.com").first()
        assert user is not None

        cipher = get_secret_cipher()
        secret = "sk-alias-token"  # noqa: S105 - test secret
        credential = models.ApiCredential(
            provider="Gemini",
            encrypted_secret=cipher.encrypt(secret),
            secret_hint=build_secret_hint(secret),
            is_active=True,
            model="gemini-1.5-pro",
            created_by_user=user,
        )
        db.add(credential)
        db.commit()

    fetch = client.get("/admin/api-credentials/gemini", headers=headers)
    assert fetch.status_code == 200, fetch.text
    payload = fetch.json()
    assert payload["model"] == "gemini-1.5-pro"
    assert payload["secret_hint"] == build_secret_hint("sk-alias-token")
