**Plan Summary**
Add a required “nickname” field to the registration flow end-to-end with minimal surface area: database migration with safe backfill, server-side validation and persistence, client form field with i18n and client validation, and a handful of focused tests. Avoid uniqueness enforcement and cross-cutting UI changes to stay within 30 minutes.

**Scope and Decisions**
- Field name: `nickname`
- Requirement: Mandatory for new registrations
- Uniqueness: Not enforced (timebox); add a non-unique index only if cheap
- Validation: Trimmed length 2–32, allow general Unicode; no profanity/emoji filtering in this pass
- Existing users: Backfill during migration with `user-{id}` then mark column NOT NULL
- i18n: Add minimal strings (EN/JA) following existing pattern
- API compatibility: Extend registration request/response; keep older clients failing fast with useful error

**Execution Steps**
- Data: Migration adds nullable `nickname`, backfill `user-{id}`, then set NOT NULL. Optional index for future uniqueness.
- API: Accept `nickname` in registration DTO, validate server-side (2–32), trim, persist, include in response.
- UI: Add required input to registration form; client validation mirrors server; include in payload; add i18n labels/help/error.
- Tests: 
  - API: missing/too short/too long nickname rejected; valid saved and returned.
  - UI: form blocks submit without valid nickname.
  - Migration: verifies existing users are backfilled and column is NOT NULL.

**Timeline Fit (≤30 min)**
- Migration + backfill: 8–10 min
- API DTO + handler validation: 8–10 min
- UI form + i18n: 6–8 min
- Tests (lightweight): 6–8 min
- Buffer overlaps by pairing simple changes; cut optional index if time runs tight.

**Residual Risks / Open Questions**
- Uniqueness not enforced; duplicates possible until a later pass.
- Validation rules may need tightening (character set, emoji, profanity).
- SSO/social flows not adjusted; may register without nickname unless they hit the same endpoint—confirm flow parity.
- Visibility/usage of nickname elsewhere is unchanged; clarify future display semantics.
- If an existing `displayName` exists, reuse might be preferable—needs confirmation.
- API versioning: extending payload may break older clients if they don’t supply nickname; acceptable given requirement?

```json
{"steps":["coder","code_quality_reviewer"],"notes":"Leanest path: a single coder can implement migration, API, UI, and tests within 30 minutes. Add code_quality_reviewer to quickly sanity-check validation/i18n consistency and migration safety. Skip integrator/release_manager to keep cycle time minimal unless CI requires them.","tests":"API: (1) POST /register without nickname -> 400 with i18n error key. (2) nickname length 1 -> 400; 33 -> 400. (3) valid nickname trims spaces and persists; response includes nickname. Migration: After migration, existing users have non-null nickname matching `user-{id}`; column is NOT NULL. UI: Registration form shows required Nickname; client blocks submit on empty/invalid; sends nickname in payload. i18n: EN/JA strings exist for label, placeholder, and validation messages."}
```