from __future__ import annotations

from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient

from .test_cards import register_and_login

assertions = TestCase()


def _create_card(client: TestClient, headers: dict[str, str], *, title: str = "Channel card") -> dict:
    response = client.post(
        "/cards",
        json={"title": title},
        headers=headers,
    )
    assertions.assertTrue(response.status_code == 201, response.text)
    return response.json()


def _get_my_channels(client: TestClient, headers: dict[str, str]) -> list[dict]:
    response = client.get("/channels/mine", headers=headers)
    assertions.assertTrue(response.status_code == 200, response.text)
    return response.json()


def test_registration_creates_private_channel_and_defaults_card_channel(client: TestClient) -> None:
    email = "channel-owner@example.com"
    headers = register_and_login(client, email)

    channels = _get_my_channels(client, headers)
    assertions.assertTrue(len(channels) == 1)
    channel = channels[0]

    assertions.assertTrue(channel["is_private"] is True)
    assertions.assertTrue(channel["owner_user_id"])

    card = _create_card(client, headers, title="Owner card")
    assertions.assertTrue(card["channel_id"] == channel["id"])

    listed = client.get("/cards", headers=headers)
    assertions.assertTrue(listed.status_code == 200)
    listings = listed.json()
    assertions.assertTrue(len(listings) == 1)
    assertions.assertTrue(listings[0]["channel_id"] == channel["id"])


def test_channel_membership_controls_card_visibility(client: TestClient) -> None:
    owner_email = "owner@example.com"
    owner_headers = register_and_login(client, owner_email)

    owner_channels = _get_my_channels(client, owner_headers)
    owner_channel_id = owner_channels[0]["id"]

    owner_card = _create_card(client, owner_headers, title="Shared work")

    member_email = "member@example.com"
    member_headers = register_and_login(client, member_email)

    member_list = client.get("/cards", headers=member_headers)
    assertions.assertTrue(member_list.status_code == 200)
    assertions.assertTrue(member_list.json() == [])

    detail_before = client.get(f"/cards/{owner_card['id']}", headers=member_headers)
    assertions.assertTrue(detail_before.status_code == 404)

    invite_response = client.post(
        f"/channels/{owner_channel_id}/invite",
        json={"email": member_email},
        headers=owner_headers,
    )
    assertions.assertTrue(invite_response.status_code == 204, invite_response.text)

    list_after = client.get("/cards", headers=member_headers)
    assertions.assertTrue(list_after.status_code == 200)
    cards_after = list_after.json()
    assertions.assertTrue(len(cards_after) == 1)
    assertions.assertTrue(cards_after[0]["id"] == owner_card["id"])
    assertions.assertTrue(cards_after[0]["channel_id"] == owner_channel_id)

    detail_after = client.get(f"/cards/{owner_card['id']}", headers=member_headers)
    assertions.assertTrue(detail_after.status_code == 200, detail_after.text)

    bad_channel_id = str(uuid4())
    create_forbidden = client.post(
        "/cards",
        json={"title": "Unauthorized", "channel_id": bad_channel_id},
        headers=member_headers,
    )
    assertions.assertTrue(create_forbidden.status_code == 403)


def test_channel_membership_management_endpoints(client: TestClient) -> None:
    owner_email = "channel-admin@example.com"
    owner_headers = register_and_login(client, owner_email)
    owner_profile = client.get("/auth/me", headers=owner_headers)
    assertions.assertTrue(owner_profile.status_code == 200)
    owner_id = owner_profile.json()["id"]

    owner_channels = _get_my_channels(client, owner_headers)
    channel_id = owner_channels[0]["id"]

    member_email = "invitee@example.com"
    member_headers = register_and_login(client, member_email)
    member_profile = client.get("/auth/me", headers=member_headers)
    assertions.assertTrue(member_profile.status_code == 200)
    member_id = member_profile.json()["id"]

    invite_response = client.post(
        f"/channels/{channel_id}/invite",
        json={"email": member_email},
        headers=owner_headers,
    )
    assertions.assertTrue(invite_response.status_code == 204, invite_response.text)

    owner_leave = client.post(f"/channels/{channel_id}/leave", headers=owner_headers)
    assertions.assertTrue(owner_leave.status_code == 409)

    member_leave = client.post(f"/channels/{channel_id}/leave", headers=member_headers)
    assertions.assertTrue(member_leave.status_code == 204, member_leave.text)

    reinvite = client.post(
        f"/channels/{channel_id}/invite",
        json={"email": member_email},
        headers=owner_headers,
    )
    assertions.assertTrue(reinvite.status_code == 204, reinvite.text)

    member_kick_owner = client.post(
        f"/channels/{channel_id}/kick",
        json={"user_id": owner_id},
        headers=member_headers,
    )
    assertions.assertTrue(member_kick_owner.status_code == 403)

    owner_kick_member = client.post(
        f"/channels/{channel_id}/kick",
        json={"user_id": member_id},
        headers=owner_headers,
    )
    assertions.assertTrue(owner_kick_member.status_code == 204, owner_kick_member.text)

    member_channels_after = _get_my_channels(client, member_headers)
    channel_ids_after = {channel["id"] for channel in member_channels_after}
    assertions.assertTrue(channel_id not in channel_ids_after)
    assertions.assertTrue(any(channel["owner_user_id"] == member_id for channel in member_channels_after))

    create_missing_member = client.post(
        "/cards",
        json={"title": "No access", "channel_id": channel_id},
        headers=member_headers,
    )
    assertions.assertTrue(create_missing_member.status_code == 403)
