from fastapi.testclient import TestClient


def test_api_sets_security_headers_on_healthcheck(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200, response.text

    headers = response.headers
    # Core security headers
    assert headers.get("Strict-Transport-Security") == "max-age=15552000; includeSubDomains"
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("Referrer-Policy") == "no-referrer"
    assert headers.get("X-Frame-Options") == "DENY"
    # Permissions/COOP/CORP
    assert headers.get("Permissions-Policy") == "camera=(), microphone=(), geolocation=()"
    assert headers.get("Cross-Origin-Opener-Policy") == "same-origin"
    assert headers.get("Cross-Origin-Resource-Policy") == "same-origin"

