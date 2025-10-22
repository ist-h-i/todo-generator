**背景**
- Periodic security review with minimal, low-risk hardening under ~30 minutes.
- Scope: Backend API (FastAPI) only; avoid SPA/architectural changes.
- Constraints: Minimal diffs, no networked audits, keep builds/tests green, document residual risks.

**変更概要**
- Added security headers middleware to harden all non-OPTIONS responses (`backend/app/main.py:156`):
  - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
  - Placed after existing CORS logic; uses `response.headers.setdefault` to avoid clobbering.
- Added focused test for `GET /health` headers (`backend/tests/test_security_headers.py:1`).
- Updated documentation with rationale and residual risks (`docs/security-review.md:1`).

**影響**
- Runtime: All API responses gain standard hardening headers; no API shape changes.
- Compatibility: Safe defaults for APIs; note `Referrer-Policy: no-referrer` may reduce analytics referrer data.
- Ops: HSTS applies over HTTPS only; COOP/CORP constrain cross-origin embedding (appropriate for APIs).

**検証**
- Targeted test: `pytest -q backend/tests/test_security_headers.py::test_api_sets_security_headers_on_healthcheck`
- Full backend: `pytest -q backend/tests`
- Manual spot-check:
  - Start: `uvicorn app.main:app --reload --app-dir backend`
  - Verify: `curl -s -D - http://localhost:8000/health | grep -E 'Strict-Transport|Content-Type-Options|Referrer-Policy|X-Frame-Options|Permissions-Policy|Cross-Origin'`
- Files to review:
  - Middleware: `backend/app/main.py:156`
  - Test: `backend/tests/test_security_headers.py:1`
  - Doc: `docs/security-review.md:1`

**レビュー観点**
- Middleware placement post-CORS; confirm `setdefault` prevents overriding upstream headers.
- Header names/values as specified; HSTS `max-age` and `Permissions-Policy` directives correct.
- `GET /health` exists and test follows existing fixture patterns.
- Environment runs HTTPS in production for HSTS effectiveness.
- Residual risks acknowledged and deferred:
  - SPA tokens in `localStorage` (recommend secure, httpOnly cookies later).
  - CSP on SPA host to be added in a future, coordinated pass.
