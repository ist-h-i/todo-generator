from unittest import TestCase

from fastapi.testclient import TestClient


assertions = TestCase()


def test_api_sets_security_headers_on_healthcheck(client: TestClient) -> None:
    response = client.get("/health")
    assertions.assertTrue(response.status_code == 200, response.text)

    headers = response.headers
    # Core security headers
    assertions.assertTrue(headers.get("Strict-Transport-Security") == "max-age=15552000; includeSubDomains")
    assertions.assertTrue(headers.get("X-Content-Type-Options") == "nosniff")
    assertions.assertTrue(headers.get("Referrer-Policy") == "no-referrer")
    assertions.assertTrue(headers.get("X-Frame-Options") == "DENY")
    # Permissions/COOP/CORP
    permissions = headers.get("Permissions-Policy", "")
    assertions.assertTrue("camera=()" in permissions)
    assertions.assertTrue("microphone=()" in permissions)
    assertions.assertTrue("geolocation=()" in permissions)
    assertions.assertTrue(headers.get("Cross-Origin-Opener-Policy") == "same-origin")
    assertions.assertTrue(headers.get("Cross-Origin-Resource-Policy") == "same-origin")

