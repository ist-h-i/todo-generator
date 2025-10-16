**What I Changed**

- backend/app/main.py:156
  - Added a small `security_headers_middleware` that sets safe, default headers on every non-`OPTIONS` response:
    - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: no-referrer`
    - `X-Frame-Options: DENY`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `Cross-Origin-Opener-Policy: same-origin`
    - `Cross-Origin-Resource-Policy: same-origin`
  - Placed after the existing CORS preflight middleware; preserves any existing values via `setdefault`.

- backend/tests/test_security_headers.py:1
  - New focused test asserting the above headers are present and correct on `GET /health`.

- docs/security-review.md
  - Documented the new security headers hardening and verification.
  - Added residual risk notes and deferred items (token storage, CSP, HSTS context).

**Why This Approach**

- Minimal diff, no API behavior changes.
- Headers are broadly safe defaults for an API.
- Test keeps the hardening from regressing with little maintenance overhead.

**How to Run Tests**

- If pytest is available:
  - `pytest -q backend/tests/test_security_headers.py::test_api_sets_security_headers_on_healthcheck`
- Full backend tests (optional):
  - `pytest -q backend/tests`

Note: In this environment `pytest` wasn’t available; commands are provided for local use.

**Residual Risks / Deferrals**

- SPA tokens in `localStorage` remain exfiltration risk under XSS; migrate to secure, httpOnly cookies (SameSite+Secure) in a dedicated cycle.
- Add CSP on the SPA host in a future pass; requires careful Angular compatibility testing.
- Ensure production runs over HTTPS so HSTS is effective.

**Files Touched**

- backend/app/main.py:156
- backend/tests/test_security_headers.py:1
- docs/security-review.md