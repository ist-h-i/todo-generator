# Security Hotspot Review

This document captures potential security hotspots identified during the manual review of the codebase.

## Weak secret storage cipher
- **Location:** `backend/app/utils/crypto.py`
- **Issue:** `SecretCipher` applies a deterministic XOR stream derived from `sha256(key)` with Base64 encoding. Without per-secret randomness or an authentication tag, equal plaintexts encrypt to identical ciphertexts and tampering cannot be detected. Attackers with database access could perform known-plaintext or bit-flipping attacks, so this mechanism does not provide confidentiality or integrity comparable to standard, well-reviewed algorithms (e.g., AES-GCM via `cryptography` or `Fernet`).
- **Recommendation:** Replace the bespoke cipher with an authenticated encryption scheme that incorporates random nonces/IVs and integrity protection.

## Token persistence in `localStorage`
- **Location:** `frontend/src/app/core/auth/auth.service.ts`
- **Issue:** Authentication bearer tokens are stored in `window.localStorage`, making them accessible to any JavaScript running on the page. An XSS vulnerability would immediately expose the token, enabling account takeover.
- **Recommendation:** Move session state to secure, httpOnly cookies (with `SameSite` and `Secure` flags) or another storage isolated from the main execution context.

## Secret hint exposes short values
- **Location:** `backend/app/utils/secrets.py`
- **Issue:** `build_secret_hint` shows the first and last segments of a secret even when the string is short (≤8 characters). In these cases the function reveals the entire secret while still appending a mask, defeating the purpose of obfuscation.
- **Recommendation:** For short secrets, display only a constant number of leading characters (e.g., 1–2) and mask the remainder, or require minimum secret length.

