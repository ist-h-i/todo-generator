Summary
- Backend middleware sets safe security headers on all non-OPTIONS responses. Implementation is correct, minimal, and preserves existing headers via setdefault.
- Tests validate headers on GET /health using existing fixture patterns; consistent with repo style.
- Documentation updated to reflect actual crypto state (hardened with Fernet + legacy auto-rotate) and correct secret masking behavior.

What I Reviewed
- backend/app/main.py: Security headers middleware
  - Correctly after CORS preflight middleware; non-OPTIONS responses get:
    - Strict-Transport-Security: max-age=15552000; includeSubDomains
    - X-Content-Type-Options: nosniff
    - Referrer-Policy: no-referrer
    - X-Frame-Options: DENY
    - Permissions-Policy: camera=(), microphone=(), geolocation=()
    - Cross-Origin-Opener-Policy: same-origin
    - Cross-Origin-Resource-Policy: same-origin
  - Uses response.headers.setdefault to avoid clobbering upstream values.
  - OPTIONS handling is harmless even if preflight short-circuits earlier.
- backend/tests/test_security_headers.py: Focused header assertions
  - Aligns with existing TestCase/assertTrue style used elsewhere.
  - Leverages standard TestClient fixture from backend/tests/conftest.py.
- Crypto and secrets utilities (sanity check):
  - backend/app/utils/crypto.py implements Fernet with legacy auto-rotation. Tests cover re-encryption and error cases.
  - backend/app/utils/secrets.py masking logic protects short secrets; tests confirm.

Tiny Nits / Edge Cases
- The middleware’s OPTIONS branch delegates to downstream middleware; it’s fine given the earlier preflight middleware, but could return early for symmetry. No change needed.
- Referrer-Policy: no-referrer is strict. If any flow relies on referrers, consider strict-origin-when-cross-origin in a later pass.

Applied Fixes
- docs/security-review.md
  - Replaced outdated “Weak secret storage cipher” with “Secret storage (Hardened)” describing Fernet + legacy rotation path.
  - Updated “Secret hint” section to reflect current, safe masking behavior.
  - Scope-limited doc edits only; no runtime impact.

Residual Risks
- HSTS requires HTTPS in production to be effective.
- COOP/CORP are safe for APIs; keep an eye on any cross-origin embedding needs.
- SPA tokens remain in localStorage; migration to secure, httpOnly cookies is still recommended in a future coordinated cycle.

Validation
- Suggest running: pytest -q backend/tests/test_security_headers.py::test_api_sets_security_headers_on_healthcheck
- Full suite: pytest -q backend/tests (tests appear self-contained and should not require network).