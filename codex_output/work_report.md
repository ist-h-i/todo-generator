**背景**
- Periodic security review to harden with minimal, low‑risk changes under a 30‑minute window.
- Scope: Backend API (FastAPI) primarily; avoid SPA/architectural changes this cycle.
- Constraints: Minimal diffs, no networked audits, keep builds/tests green, document residual risks.

**変更概要**
- Backend security headers middleware added to `backend/app/main.py:156`:
  - Sets safe defaults on non-`OPTIONS` responses via `response.headers.setdefault`.
  - Headers: `Strict-Transport-Security: max-age=15552000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
  - Placed after existing CORS handling; does not clobber pre-set values.
- Test added `backend/tests/test_security_headers.py:1` to assert headers on `GET /health`.
- Documentation updated `docs/security-review.md` with changes, rationale, and residual risks (token storage, CSP, HSTS context).

**影響**
- Runtime: All API responses now include standard hardening headers; no API surface or payload changes.
- Compatibility: Generally safe for APIs. Note `Referrer-Policy: no-referrer` may affect analytics reliant on referrers.
- Ops: HSTS effective only over HTTPS; COOP/CORP restrict cross-origin interactions (appropriate for APIs).

**検証**
- Targeted test: `pytest -q backend/tests/test_security_headers.py::test_api_sets_security_headers_on_healthcheck`
- Full backend: `pytest -q backend/tests`
- Manual spot-check (optional): `curl -s -D - http://localhost:<port>/health | grep -E 'Strict-Transport|Content-Type-Options|Referrer-Policy|X-Frame-Options|Permissions-Policy|Cross-Origin'`
- Files to review:
  - `backend/app/main.py:156`
  - `backend/tests/test_security_headers.py:1`
  - `docs/security-review.md`

**レビュー観点**
- Confirm middleware placement post-CORS and use of `setdefault` (no header clobbering).
- Validate header names/values match policy, especially HSTS max-age and `Permissions-Policy` directives.
- Ensure `GET /health` exists and test uses established fixtures/patterns in this repo.
- Environment check: Production runs HTTPS so HSTS is meaningful; no flows depend on referrer headers.
- Residual risks (deferred by design): SPA tokens in `localStorage` (recommend httpOnly cookies later), CSP on SPA host, dependency CVE audits pending due to restricted network.