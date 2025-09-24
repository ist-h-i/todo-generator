from __future__ import annotations

import base64
import json

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, email: str, password: str = "Password123!") -> tuple[str, dict[str, str]]:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201
    payload = response.json()
    token = payload["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return token, headers


def test_profile_defaults(client: TestClient, email: str) -> None:
    _, headers = _register_and_login(client, email)

    response = client.get("/profile/me", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401

    response = client.get("/profile/me", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["nickname"] is None
    assert data["roles"] == []
    assert data["avatar_url"] is None


def test_profile_update_round_trip(client: TestClient, email: str) -> None:
    _, headers = _register_and_login(client, email)

    avatar_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIklEQVR42mNgoBfgPxBmBhBgGAWjYBSMglEwCkbBAgBgAADX0wQKX/9S1gAAAABJRU5ErkJggg=="
    )

    payload = {
        "nickname": "田中 太郎",
        "experience_years": "7",
        "roles": json.dumps(["Java", "フロント"]),
        "bio": "Javaとフロントエンドの開発が得意です。",
        "location": "東京都",
        "portfolio_url": "https://example.com/portfolio",
    }
    files = {"avatar": ("avatar.png", avatar_bytes, "image/png")}

    response = client.put("/profile/me", data=payload, files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["nickname"] == "田中 太郎"
    assert data["experience_years"] == 7
    assert data["roles"] == ["Java", "フロント"]
    assert data["bio"].startswith("Javaとフロントエンド")
    assert data["location"] == "東京都"
    assert data["portfolio_url"] == "https://example.com/portfolio"
    assert data["avatar_url"].startswith("data:image/webp;base64,")

    follow_up = client.get("/profile/me", headers=headers)
    assert follow_up.status_code == 200
    follow_data = follow_up.json()
    assert follow_data["nickname"] == "田中 太郎"
    assert follow_data["roles"] == ["Java", "フロント"]

    removal_response = client.put(
        "/profile/me",
        data={
            "nickname": "田中 太郎",
            "roles": json.dumps(["Java", "フロント"]),
            "remove_avatar": "true",
        },
        headers=headers,
    )
    assert removal_response.status_code == 200
    assert removal_response.json()["avatar_url"] is None


def test_profile_roles_limit(client: TestClient, email: str) -> None:
    _, headers = _register_and_login(client, email)

    too_many_roles = [f"Role {index}" for index in range(6)]

    response = client.put(
        "/profile/me",
        data={
            "nickname": "開発者",
            "roles": json.dumps(too_many_roles),
        },
        headers=headers,
    )
    assert response.status_code == 422
