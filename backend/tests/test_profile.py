from __future__ import annotations

import base64
import json
from unittest import TestCase

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from .utils.auth import register_user

assertions = TestCase()

_DEFAULT_TEST_PASSWORD = "Password123!"  # noqa: S105 - fixed credential for test accounts


def _register_and_login(
    client: TestClient, email: str, password: str = _DEFAULT_TEST_PASSWORD
) -> tuple[str, dict[str, str]]:
    payload = register_user(client, email=email, password=password, nickname="ProfileUser")
    token = payload["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return token, headers


def test_profile_defaults(client: TestClient, email: str) -> None:
    _, headers = _register_and_login(client, email)

    response = client.get("/profile/me", headers={"Authorization": "Bearer invalid"})
    assertions.assertTrue(response.status_code == 401)

    response = client.get("/profile/me", headers=headers)
    assertions.assertTrue(response.status_code == 200)
    data = response.json()

    assertions.assertTrue(isinstance(data["nickname"], str) and data["nickname"].strip() != "")
    assertions.assertTrue(data["roles"] == [])
    assertions.assertTrue(data["avatar_url"] is None)


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
    }
    files = {"avatar": ("avatar.png", avatar_bytes, "image/png")}

    response = client.put("/profile/me", data=payload, files=files, headers=headers)
    assertions.assertTrue(response.status_code == 200)
    data = response.json()

    assertions.assertTrue(data["nickname"] == "田中 太郎")
    assertions.assertTrue(data["experience_years"] == 7)
    assertions.assertTrue(data["roles"] == ["Java", "フロント"])
    assertions.assertTrue(data["bio"].startswith("Javaとフロントエンド"))
    assertions.assertTrue(data["avatar_url"].startswith("data:image/webp;base64,"))

    follow_up = client.get("/profile/me", headers=headers)
    assertions.assertTrue(follow_up.status_code == 200)
    follow_data = follow_up.json()
    assertions.assertTrue(follow_data["nickname"] == "田中 太郎")
    assertions.assertTrue(follow_data["roles"] == ["Java", "フロント"])

    removal_response = client.put(
        "/profile/me",
        data={
            "nickname": "田中 太郎",
            "roles": json.dumps(["Java", "フロント"]),
            "remove_avatar": "true",
        },
        headers=headers,
    )
    assertions.assertTrue(removal_response.status_code == 200)
    assertions.assertTrue(removal_response.json()["avatar_url"] is None)


def test_avatar_upload_missing_pillow(monkeypatch, client: TestClient, email: str) -> None:
    from app.services import profile

    _, headers = _register_and_login(client, email)

    def _raise_missing_dependency() -> None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=profile._MISSING_PILLOW_MESSAGE,
        )

    monkeypatch.setattr(profile, "_import_pillow", _raise_missing_dependency)

    avatar_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIklEQVR42mNgoBfgPxBmBhBgGAWjYBSMglEwCkbBAgBgAADX0wQKX/9S1gAAAABJRU5ErkJ"
        "ggg=="
    )

    response = client.put(
        "/profile/me",
        data={"nickname": "田中 太郎"},
        files={"avatar": ("avatar.png", avatar_bytes, "image/png")},
        headers=headers,
    )

    assertions.assertTrue(response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR)
    assertions.assertTrue(response.json()["detail"] == profile._MISSING_PILLOW_MESSAGE)


def test_profile_roles_limit(client: TestClient, email: str) -> None:
    _, headers = _register_and_login(client, email)

    too_many_roles = [f"Role {index}" for index in range(11)]

    response = client.put(
        "/profile/me",
        data={
            "nickname": "開発者",
            "roles": json.dumps(too_many_roles),
        },
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 422)


def test_parse_roles_deduplicates_case_insensitively() -> None:
    from app.services import profile

    payload = json.dumps(["DevOps", "devops", " DEVOPS ", "QA", "qa"])

    result = profile.parse_roles(payload)

    assertions.assertTrue(result == ["DevOps", "QA"])
