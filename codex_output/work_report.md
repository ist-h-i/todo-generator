**背景**
- Goal: Require a “Nickname” during user registration so every account has an associated nickname.
- Scope: Minimal surface change limited to registration, persistence, and i18n; no broad UI/API refactors.
- Existing users: Must be handled without blocking; backfill approach selected.

**変更概要**
- Data model/migration: Add `nickname` (VARCHAR 64). Startup backfills `user-{id}` where nickname is null/empty; schema remains nullable for compatibility.
- API: Extend `POST /auth/register` to require `nickname`. Normalize/trim; validate non-empty and max length 64; persist and return with user profile.
- Frontend: Add required “ニックネーム” field to the registration form with client-side validation mirroring server rules; include in payload.
- Tests: Update registration helpers and specs to provide nicknames; add cases for missing/too short/too long inputs.

**影響**
- Breaking for old clients: Registrations without `nickname` now fail with a clear validation error.
- Existing users: Receive default `user-{id}` nickname after backfill; may become visible wherever nickname is displayed.
- Uniqueness: Not enforced in this pass; duplicates are possible.
- SSO/social: Unchanged; must supply or prompt for nickname if they hit the same registration path.

**検証**
- API: Verified 400/422 on missing/invalid nickname; valid values are trimmed, persisted, and returned.
- Migration: Verified backfill assigns non-empty `user-{id}`; post-migration users have non-null values in practice.
- UI: Registration form blocks submit when nickname invalid/empty; successful submit includes nickname.
- Consistency: Server/client share non-empty + 64-char max; messages follow existing i18n pattern.

**レビュー観点**
- Validation policy: Confirm min length and allowed characters; current pass uses trim + non-empty + max 64, no profanity/emoji filtering.
- Uniqueness: Decide whether to enforce globally (case/Unicode rules) and when to add constraints/indexing.
- Schema hardening: When to migrate `nickname` to NOT NULL after safe rollout.
- SSO flows: Confirm nickname capture behavior for social/enterprise providers.
- UX/i18n: Finalize label/help/error copy and accessibility cues; confirm languages supported.
- Visibility/editability: Where nickname appears and whether users can change it (rules/rate limits).

Residual risks/open questions are called out above; guidance on uniqueness, stricter validation, and NOT NULL timing will shape any follow-up.