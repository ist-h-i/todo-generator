Summary of changes
- Backend registration now requires and persists a sanitized nickname.
- Database startup migration backfills missing nicknames for existing users.
- Frontend registration UI includes a required “Nickname” field with validation.
- Tests updated to supply nicknames and to reflect the new requirement.

Files changed (focused diffs)

Backend
- backend/app/schemas.py:1
  - Add `nickname: str` to `RegistrationRequest`.
- backend/app/routers/auth.py:1
  - Validate/sanitize nickname during registration using `normalize_nickname` and persist to `User.nickname`.
- backend/app/migrations.py:1
  - Add `_backfill_user_nickname(engine)` to assign `user-{id}` for users with null/empty nickname.
  - Call `_backfill_user_nickname(engine)` in `run_startup_migrations` after ensuring profile columns.
- backend/tests/test_cards.py:1
  - `register_and_login` now posts nickname `Tester`.
- backend/tests/test_admin_users.py:1
  - Include nicknames (“Owner”, “Member”, “Second”) for all `POST /auth/register` calls.
- backend/tests/test_report_templates.py:1
  - `_register_user` now sends nickname `Admin`.
- backend/tests/test_status_reports.py:1
  - Helper `register_and_login` now sends nickname `Reporter`.
- backend/tests/test_security.py:1
  - `_register_user` adds nickname `User`; direct registration calls updated with nicknames.
- backend/tests/test_competency_evaluations.py:1
  - `_register` sends nickname `Member`.
- backend/tests/test_profile.py:1
  - `_register_and_login` sends nickname `ProfileUser`.
  - `test_profile_defaults` now expects nickname is a non-empty string.
- backend/tests/test_appeals.py:1
  - Helper `register_and_login` sends nickname `AppealsUser`.
- backend/tests/test_admin_settings.py:1
  - `_admin_headers` registers with nickname `Owner`.

Frontend
- frontend/src/app/core/auth/auth.service.ts:1
  - `register(email, password, nickname)` now includes `nickname` in the API payload.
- frontend/src/app/features/auth/login/page.ts:1
  - Registration form state adds `nickname`.
  - Add nickname touched state, error computation, validation (`getNicknameError`).
  - Include nickname in submit validation and pass to `AuthService.register`.
  - Add `onRegisterNicknameInput` handler.
- frontend/src/app/features/auth/login/page.html:1
  - Add required “ニックネーム” input with error display to registration form.

How it works (backend)
- API contract
  - Request: POST `/auth/register` expects JSON `{ email, password, nickname }`.
  - Response: unchanged shape; `user.nickname` included as before via `UserProfile`.
- Validation
  - Server uses `normalize_nickname` (Japanese messages, trims whitespace, requires non-empty, max length 100).
  - Email/password validation unchanged.
- Migration/backfill
  - On startup, any user with `NULL` or empty `nickname` is set to `user-{id}`. Column remains nullable for compatibility.
  - No uniqueness constraints are enforced.

How it works (frontend)
- Registration form now includes a nickname field with client-side checks that mirror server messaging style:
  - Required; max length 100 characters; trimmed before submission.
- Auth service sends `{ email, password, nickname }` to `/auth/register`.
- UX remains the same otherwise.

Commands to run
- Backend (optional validation):
  - `pytest -q` (from `backend/`) to verify test updates pass.
- Frontend (optional build):
  - `npm ci` (from `frontend/`)
  - `npm run build` or `npm run start` to ensure the UI compiles with the new field.

Residual risks / open questions
- Validation limits: This pass enforces required and max length (100) consistent with existing profile UI, not the previously proposed 2–32 range.
- Uniqueness: Not enforced. Duplicate nicknames are possible.
- Existing users: Backfill uses `user-{id}`; visible if shown in UI. If a different default is preferred, please specify.
- SSO/social: Not adjusted. Those flows must supply or prompt for a nickname if they use the same endpoint.
- Editability: Users can still change nickname in Profile dialog. No rate limiting/audit added.

Notes
- I kept changes minimal and reused existing validation/i18n patterns.
- If you want stricter nickname rules (e.g., 2–32 chars, character sets, uniqueness), I can add them in a follow-up with migration/indexing updates.