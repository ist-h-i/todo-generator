from fastapi.testclient import TestClient


def test_get_auth_login_redirects_to_frontend(client: TestClient) -> None:
    response = client.get("/auth/login", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers.get("location", "").endswith("/login")


def test_get_auth_root_redirects_to_frontend(client: TestClient) -> None:
    response = client.get("/auth/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers.get("location", "").endswith("/login")

