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
            "confidence_threshold": 70,
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
    assert template["confidence_threshold"] == 70
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
            "confidence_threshold": 50,
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
    assert updated["confidence_threshold"] == 50

    delete_response = client.delete(f"/workspace/templates/{template_id}", headers=headers)
    assert delete_response.status_code == 204
    remaining = client.get("/workspace/templates", headers=headers).json()
    assert all(entry["id"] != template_id for entry in remaining)


def test_default_template_is_provisioned_for_each_user(client: TestClient) -> None:
    headers = register_and_login(client, "default-template@example.com")

    response = client.get("/workspace/templates", headers=headers)
    assert response.status_code == 200
    templates = response.json()
    default_template = next((entry for entry in templates if entry["is_system_default"]), None)

    assert default_template is not None
    assert default_template["name"] == "標準テンプレート"
    assert default_template["owner_id"] is not None


def test_removing_default_template_does_not_affect_other_users(client: TestClient) -> None:
    owner_headers = register_and_login(client, "default-owner@example.com")
    other_headers = register_and_login(client, "default-other@example.com")

    owner_templates = client.get("/workspace/templates", headers=owner_headers).json()
    other_templates = client.get("/workspace/templates", headers=other_headers).json()

    owner_default = next(entry for entry in owner_templates if entry["is_system_default"])
    other_default = next(entry for entry in other_templates if entry["is_system_default"])

    assert owner_default["id"] != other_default["id"]

    delete_response = client.delete(
        f"/workspace/templates/{owner_default['id']}",
        headers=owner_headers,
    )
    assert delete_response.status_code == 204

    owner_after = client.get("/workspace/templates", headers=owner_headers).json()
    other_after = client.get("/workspace/templates", headers=other_headers).json()

    assert all(entry["id"] != owner_default["id"] for entry in owner_after)
    assert any(entry["id"] == other_default["id"] for entry in other_after)
