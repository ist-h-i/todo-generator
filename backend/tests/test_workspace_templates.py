from unittest import TestCase

from fastapi.testclient import TestClient

from backend.app.routers.workspace_templates import DEFAULT_FIELD_VISIBILITY

from .test_cards import create_label, create_status, register_and_login

assertions = TestCase()


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
    assertions.assertTrue(create_response.status_code == 201, create_response.text)
    template = create_response.json()
    assertions.assertTrue(template["name"] == "Sprint Template")
    assertions.assertTrue(template["confidence_threshold"] == 70)
    assertions.assertTrue(
        template["field_visibility"]
        == {
            **DEFAULT_FIELD_VISIBILITY,
            "show_story_points": True,
            "show_due_date": True,
            "show_assignee": False,
            "show_confidence": True,
        }
    )
    template_id = template["id"]

    list_response = client.get("/workspace/templates", headers=headers)
    assertions.assertTrue(list_response.status_code == 200)
    templates = list_response.json()
    assertions.assertTrue(any(entry["id"] == template_id for entry in templates))

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
    assertions.assertTrue(update_response.status_code == 200, update_response.text)
    updated = update_response.json()
    assertions.assertTrue(updated["name"] == "Updated Template")
    assertions.assertTrue(updated["default_label_ids"] == [])
    assertions.assertTrue(updated["field_visibility"]["show_story_points"] is False)
    assertions.assertTrue(updated["confidence_threshold"] == 50)

    delete_response = client.delete(f"/workspace/templates/{template_id}", headers=headers)
    assertions.assertTrue(delete_response.status_code == 204)
    remaining = client.get("/workspace/templates", headers=headers).json()
    assertions.assertTrue(all(entry["id"] != template_id for entry in remaining))


def test_cannot_delete_system_default_template(client: TestClient) -> None:
    headers = register_and_login(client, "workspace-template-default@example.com")

    list_response = client.get("/workspace/templates", headers=headers)
    assertions.assertTrue(list_response.status_code == 200, list_response.text)
    templates = list_response.json()
    assertions.assertTrue(templates, "Expected default template to be provisioned")

    default_template = next(
        (template for template in templates if template.get("is_system_default")),
        None,
    )
    assertions.assertTrue(default_template is not None, "System default template should exist")

    delete_response = client.delete(
        f"/workspace/templates/{default_template['id']}",
        headers=headers,
    )
    assertions.assertTrue(delete_response.status_code == 400)
    assertions.assertTrue("cannot be deleted" in delete_response.json()["detail"].lower())

    post_delete_templates = client.get("/workspace/templates", headers=headers).json()
    assertions.assertTrue(any(entry["id"] == default_template["id"] for entry in post_delete_templates))


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
    assertions.assertTrue(create_response.status_code == 201, create_response.text)
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
    assertions.assertTrue(update_response.status_code == 200, update_response.text)
    updated_visibility = update_response.json()["field_visibility"]
    expected_visibility = dict(DEFAULT_FIELD_VISIBILITY)
    expected_visibility.update(
        {
            "show_story_points": False,
            "show_due_date": True,
            "show_assignee": True,
            "show_confidence": False,
        }
    )
    expected_visibility["show_confidence"] = True
    assertions.assertTrue(updated_visibility == expected_visibility)
