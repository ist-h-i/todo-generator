from __future__ import annotations

from unittest import TestCase

from fastapi.testclient import TestClient

from .test_cards import create_status, register_and_login

assertions = TestCase()


def _update_nickname(client: TestClient, headers: dict[str, str], nickname: str) -> None:
    response = client.put(
        "/profile/me",
        data={"nickname": nickname},
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 200, response.text)


def _create_card_with_subtask(
    client: TestClient,
    headers: dict[str, str],
    status_id: str,
) -> tuple[str, str]:
    response = client.post(
        "/cards",
        json={
            "title": "コメントの検証",
            "status_id": status_id,
            "subtasks": [{"title": "仕様確認"}],
        },
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 201, response.text)
    payload = response.json()
    card_id = payload["id"]
    subtask_id = payload["subtasks"][0]["id"]
    return card_id, subtask_id


def test_subtask_comment_crud_flow(client: TestClient) -> None:
    headers = register_and_login(client, "commenter@example.com")
    _update_nickname(client, headers, "ボード担当者")

    status_id = create_status(client, headers)
    card_id, subtask_id = _create_card_with_subtask(client, headers, status_id)

    create_response = client.post(
        "/comments",
        json={
            "card_id": card_id,
            "subtask_id": subtask_id,
            "content": "初回メモ",
        },
        headers=headers,
    )
    assertions.assertTrue(create_response.status_code == 201, create_response.text)
    created = create_response.json()
    assertions.assertTrue(created["card_id"] == card_id)
    assertions.assertTrue(created["subtask_id"] == subtask_id)
    assertions.assertTrue(created["content"] == "初回メモ")
    assertions.assertTrue(created["author_id"])
    assertions.assertTrue(created["author_nickname"] == "ボード担当者")

    list_response = client.get(
        "/comments",
        params={"card_id": card_id, "subtask_id": subtask_id},
        headers=headers,
    )
    assertions.assertTrue(list_response.status_code == 200, list_response.text)
    listed = list_response.json()
    assertions.assertTrue(len(listed) == 1)
    assertions.assertTrue(listed[0]["author_nickname"] == "ボード担当者")

    update_response = client.put(
        f"/comments/{created['id']}",
        json={"content": "更新済みメモ", "subtask_id": subtask_id},
        headers=headers,
    )
    assertions.assertTrue(update_response.status_code == 200, update_response.text)
    updated = update_response.json()
    assertions.assertTrue(updated["content"] == "更新済みメモ")
    assertions.assertTrue(updated["author_nickname"] == "ボード担当者")
    assertions.assertTrue(updated["updated_at"] != created["updated_at"])

    delete_response = client.delete(
        f"/comments/{created['id']}",
        headers=headers,
    )
    assertions.assertTrue(delete_response.status_code == 204, delete_response.text)

    empty_response = client.get(
        "/comments",
        params={"card_id": card_id, "subtask_id": subtask_id},
        headers=headers,
    )
    assertions.assertTrue(empty_response.status_code == 200)
    assertions.assertTrue(empty_response.json() == [])
