from unittest import TestCase

from fastapi.testclient import TestClient

assertions = TestCase()


def _register_user(
    client: TestClient, email: str, password: str = "SecurePass123!",  # noqa: S107
) -> dict:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password, "nickname": "Admin"},
    )
    assertions.assertTrue(response.status_code == 201, response.text)
    return response.json()


def test_report_templates_are_scoped_per_admin(client: TestClient) -> None:
    admin_one = _register_user(client, "owner@example.com")
    admin_one_headers = {"Authorization": f"Bearer {admin_one['access_token']}"}

    admin_two = _register_user(client, "second@example.com")
    admin_two_headers = {"Authorization": f"Bearer {admin_two['access_token']}"}

    promote_response = client.patch(
        f"/admin/users/{admin_two['user']['id']}",
        headers=admin_one_headers,
        json={"is_admin": True},
    )
    assertions.assertTrue(promote_response.status_code == 200, promote_response.text)
    assertions.assertTrue(promote_response.json()["is_admin"] is True)

    owner_template_response = client.post(
        "/reports/templates",
        headers=admin_one_headers,
        json={
            "name": "Owner template",
            "audience": "executive",
            "sections": ["alpha"],
            "branding": {"accent": "blue"},
        },
    )
    assertions.assertTrue(owner_template_response.status_code == 201, owner_template_response.text)
    owner_template = owner_template_response.json()
    assertions.assertTrue(owner_template["owner_id"] == admin_one["user"]["id"])

    other_template_response = client.post(
        "/reports/templates",
        headers=admin_two_headers,
        json={
            "name": "Second template",
            "audience": "team",
            "sections": ["beta"],
            "branding": {},
        },
    )
    assertions.assertTrue(other_template_response.status_code == 201, other_template_response.text)
    other_template = other_template_response.json()
    assertions.assertTrue(other_template["owner_id"] == admin_two["user"]["id"])

    owner_list_response = client.get("/reports/templates", headers=admin_one_headers)
    assertions.assertTrue(owner_list_response.status_code == 200, owner_list_response.text)
    owner_templates = owner_list_response.json()
    assertions.assertTrue([template["name"] for template in owner_templates] == ["Owner template"])

    other_list_response = client.get("/reports/templates", headers=admin_two_headers)
    assertions.assertTrue(other_list_response.status_code == 200, other_list_response.text)
    other_templates = other_list_response.json()
    assertions.assertTrue([template["name"] for template in other_templates] == ["Second template"])

    forbidden_get = client.get(
        f"/reports/templates/{other_template['id']}",
        headers=admin_one_headers,
    )
    assertions.assertTrue(forbidden_get.status_code == 404)

    forbidden_update = client.patch(
        f"/reports/templates/{other_template['id']}",
        headers=admin_one_headers,
        json={"name": "Should not work"},
    )
    assertions.assertTrue(forbidden_update.status_code == 404)
