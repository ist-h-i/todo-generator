from __future__ import annotations

from fastapi.testclient import TestClient


def _create_admin(client: TestClient) -> tuple[dict[str, str], str]:
    email = "owner@example.com"
    password = "AdminPass123!"  # noqa: S105 - test credential

    register = client.post("/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201, register.text
    admin_id = register.json()["user"]["id"]

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, admin_id


def test_admin_can_delete_user(client: TestClient) -> None:
    headers, _ = _create_admin(client)

    user_register = client.post(
        "/auth/register",
        json={"email": "member@example.com", "password": "Password123!"},
    )
    assert user_register.status_code == 201, user_register.text
    user_id = user_register.json()["user"]["id"]

    before = client.get("/admin/users", headers=headers)
    assert before.status_code == 200, before.text
    before_ids = {user["id"] for user in before.json()}
    assert user_id in before_ids

    response = client.delete(f"/admin/users/{user_id}", headers=headers)
    assert response.status_code == 204, response.text

    after = client.get("/admin/users", headers=headers)
    assert after.status_code == 200, after.text
    after_ids = {user["id"] for user in after.json()}
    assert user_id not in after_ids


def test_admin_cannot_delete_self(client: TestClient) -> None:
    headers, admin_id = _create_admin(client)

    response = client.delete(f"/admin/users/{admin_id}", headers=headers)
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "Cannot delete your own account."
