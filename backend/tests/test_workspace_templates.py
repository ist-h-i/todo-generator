from fastapi.testclient import TestClient

from .test_cards import create_label, create_status, register_and_login


def test_workspace_template_crud_flow(client: TestClient) -> None:
    headers = register_and_login(client, "workspace-template@example.com")
    status_id = create_status(client, headers)
    label_id = create_label(client, headers)

    create_response = client.post(
        "/workspace/templates",
        json={
            "name": "Sprint Template",
            "description": "Used for sprint boards",
            "default_status_id": status_id,
            "default_label_ids": [label_id],
            "confidence_threshold": 0.7,
            "field_visibility": {
                "show_story_points": True,
                "show_due_date": True,
                "show_assignee": False,
                "show_confidence": True,
            },
        },
        headers=headers,
    )
    assert create_response.status_code == 201, create_response.text
    template = create_response.json()
    assert template["name"] == "Sprint Template"
    template_id = template["id"]

    list_response = client.get("/workspace/templates", headers=headers)
    assert list_response.status_code == 200
    templates = list_response.json()
    assert any(entry["id"] == template_id for entry in templates)

    update_response = client.patch(
        f"/workspace/templates/{template_id}",
        json={
            "name": "Updated Template",
            "default_label_ids": [],
            "confidence_threshold": 0.5,
            "field_visibility": {
                "show_story_points": False,
                "show_due_date": True,
                "show_assignee": True,
                "show_confidence": False,
            },
        },
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["name"] == "Updated Template"
    assert updated["default_label_ids"] == []
    assert updated["field_visibility"]["show_story_points"] is False

    delete_response = client.delete(f"/workspace/templates/{template_id}", headers=headers)
    assert delete_response.status_code == 204
    remaining = client.get("/workspace/templates", headers=headers).json()
    assert all(entry["id"] != template_id for entry in remaining)


def test_partial_field_visibility_update_preserves_existing(client: TestClient) -> None:
    headers = register_and_login(client, "workspace-template-visibility@example.com")
    status_id = create_status(client, headers)

    create_response = client.post(
        "/workspace/templates",
        json={
            "name": "Visibility Template",
            "default_status_id": status_id,
            "field_visibility": {
                "show_story_points": False,
                "show_due_date": True,
                "show_assignee": True,
                "show_confidence": False,
            },
        },
        headers=headers,
    )
    assert create_response.status_code == 201, create_response.text
    template_id = create_response.json()["id"]

    update_response = client.patch(
        f"/workspace/templates/{template_id}",
        json={
            "field_visibility": {
                "show_confidence": True,
            }
        },
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    updated_visibility = update_response.json()["field_visibility"]
    assert updated_visibility == {
        "show_story_points": False,
        "show_due_date": True,
        "show_assignee": True,
        "show_confidence": True,
    }
