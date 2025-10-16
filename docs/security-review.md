# Security Hotspot Review

This document captures potential security hotspots identified during the manual review of the codebase.

## Secret storage (Hardened)
- **Location:** `backend/app/utils/crypto.py`
- **Status:** `SecretCipher` uses authenticated encryption via `cryptography.Fernet` (versioned `v2:` payloads). Legacy base64/XOR payloads are supported for reads and automatically surfaced as a `reencrypted_payload` to enable write-back rotation to modern format; this path is exercised in tests.
- **Action:** No change required this cycle. Ensure `SECRET_ENCRYPTION_KEY` is configured, non-empty, and stable across deployments. Tests cover rotation and error handling for mismatched keys.

## Token persistence in `localStorage`
- **Location:** `frontend/src/app/core/auth/auth.service.ts`
- **Issue:** Authentication bearer tokens are stored in `window.localStorage`, making them accessible to any JavaScript running on the page. An XSS vulnerability would immediately expose the token, enabling account takeover.
- **Recommendation:** Move session state to secure, httpOnly cookies (with `SameSite` and `Secure` flags) or another storage isolated from the main execution context.

## Secret hint masking (OK)
- **Location:** `backend/app/utils/secrets.py`
- **Status:** `build_secret_hint` limits exposure for short values (≤8 chars) by revealing at most one leading character and masking the remainder with a minimum mask length. Behavior is validated in tests.
- **Action:** No change required this cycle.

## API response security headers (Hardened)
- **Location:** `backend/app/main.py`
- **Change:** Added an HTTP middleware to set baseline security headers on all non-`OPTIONS` responses:
  - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
- **Rationale:** Minimal, low-risk hardening that does not change API semantics and improves default browser protections.
- **Verification:** `backend/tests/test_security_headers.py` asserts presence and values on `GET /health`.

## Residual risks and follow-ups
- SPA stores tokens in `localStorage` (see above). Recommend migrating to secure, httpOnly cookies with `SameSite` and `Secure` in a future, coordinated cycle.
- Consider adding a Content Security Policy (CSP) at the SPA host. This requires careful testing due to Angular build/runtime constraints; defer to a dedicated pass.
- Ensure production uses HTTPS so HSTS is effective. HSTS is advisory over plaintext connections.
