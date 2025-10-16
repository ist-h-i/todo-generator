Summary
- Scope: Backend API (FastAPI) and Angular SPA.
- Priority: Apply smallest, low‑risk hardening; avoid architectural changes.
- Timebox: ≤30 minutes for execution; minimal diff.

Plan
- Add standard security headers in backend to harden all responses with minimal risk.
- Add a small test to assert these headers exist (keeps builds green and verifies behavior).
- Update the security review doc to document findings, the change, and residual risks.
- Defer larger refactors (token storage/cookies, CSP) as explicitly logged backlog items.

Proposed Minimal Changes
- Backend security headers middleware
  - File: backend/app/main.py
  - Add middleware after existing CORS handling to set:
    - Strict-Transport-Security: max-age=15552000; includeSubDomains
    - X-Content-Type-Options: nosniff
    - Referrer-Policy: no-referrer
    - X-Frame-Options: DENY
    - Permissions-Policy: camera=(), microphone=(), geolocation=()
    - Cross-Origin-Opener-Policy: same-origin
    - Cross-Origin-Resource-Policy: same-origin
  - Rationale: No functional coupling; safe for API responses; improves baseline security.

- Test coverage
  - File: backend/tests/test_security.py
  - Add a simple assertion on GET /health:
    - Verifies presence and values of the above headers.
  - Rationale: Ensures permanence of security hardening with minimal test code.

- Documentation
  - File: docs/security-review.md
  - Update to:
    - Mark cryptography status as “hardened” (Fernet AE) and legacy auto-rotate note.
    - Note new security headers and why they’re safe.
    - Call out residual risk: SPA stores tokens in localStorage; recommend migration to httpOnly cookies in a future cycle.
    - Note CSP as a future enhancement on the frontend host, with caution about Angular inline/hydration constraints.

Why Not Now (Defer)
- Token storage migration to httpOnly cookies: cross-cutting change (backend + SPA) and requires CORS/auth flows; exceeds timebox.
- Frontend CSP: likely build-time and inline-script considerations; risk of regressions; requires careful testing.
- Dependency bumps: versions already recent; without network audit, blind updates could introduce churn; low ROI in this pass.

Residual Risks
- SPA token in localStorage remains susceptible to XSS exfiltration; mitigations deferred.
- CSP not applied on SPA host yet.
- HSTS is informative on API responses; ensure production uses HTTPS for header effect.

Acceptance Criteria
- All API responses include the new security headers.
- backend/tests remain green; added header test passes.
- docs/security-review.md updated with changes and residual risks.

Implementation Hints
- Middleware snippet example (for coder):
  - In backend/app/main.py, add an HTTP middleware that sets headers on every non-OPTIONS response (OPTIONS already handled).
- Test snippet example:
  - client.get('/health') and assert headers with exact names/values.

```json
{"steps":["coder","code_quality_reviewer"],"notes":"Apply a small security-headers middleware in backend/app/main.py, add a single test in backend/tests/test_security.py to assert headers on /health, and update docs/security-review.md with findings and residual risks. Token storage migration and CSP are intentionally deferred to keep changes minimal and within the 30-minute window.","tests":"Run backend tests. New assertions: response.headers['Strict-Transport-Security'] == 'max-age=15552000; includeSubDomains', 'X-Content-Type-Options' == 'nosniff', 'Referrer-Policy' == 'no-referrer', 'X-Frame-Options' == 'DENY', 'Permissions-Policy' includes 'camera=()', 'microphone=()', 'geolocation=()', and COOP/CORP set to 'same-origin'."}
```