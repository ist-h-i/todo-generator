**Release Summary**
- Hardened API responses with minimal, safe security headers middleware in FastAPI.
- Added a focused test to lock behavior; updated security review docs.
- No dependency changes; API surface and payloads unchanged.

**What Changed**
- Backend middleware adds default headers on non-OPTIONS responses:
  - `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`
  - File: `backend/app/main.py:163`
- Test asserts headers on `GET /health`:
  - File: `backend/tests/test_security_headers.py:1`
- Docs updated with change rationale and residual risks:
  - File: `docs/security-review.md:1`

**Scope & Compatibility**
- Runtime-only hardening; preserves any pre-set header values via `setdefault`.
- Safe for APIs. Note: `Referrer-Policy: no-referrer` may reduce referrer data available to analytics.
- HSTS effective only over HTTPS (no functional change on HTTP).

**Verification Steps**
- Targeted test: `pytest -q backend/tests/test_security_headers.py::test_api_sets_security_headers_on_healthcheck`
- Full backend tests: `pytest -q backend/tests`
- Manual spot-check:
  - `uvicorn app.main:app --reload --app-dir backend`
  - `curl -s -D - http://localhost:8000/health | grep -E 'Strict-Transport|Content-Type-Options|Referrer-Policy|X-Frame-Options|Permissions-Policy|Cross-Origin'`

**Risks & Residuals**
- Referrer policy strictness could impact analytics relying on referrers.
- HSTS requires HTTPS in production to take effect.
- Deferred (future cycle): move SPA tokens from `localStorage` to secure, httpOnly cookies; add CSP on SPA host.

**Rollback Plan**
- Remove the security headers middleware block if needed:
  - `backend/app/main.py:163` (entire `security_headers_middleware`)
- Delete the focused test if reverting behavior:
  - `backend/tests/test_security_headers.py:1`
- Revert doc note:
  - `docs/security-review.md:1`

**Release Verdict**
- Ready to ship. Minimal, self-contained change with clear tests and documentation.