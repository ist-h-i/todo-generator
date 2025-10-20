**Summary**
Add a required “Nickname” field to the user registration flow so that every newly registered user has a nickname stored and associated with their account. Ensure persistence, validation, and data model support; address existing users without nicknames.

**Assumptions**
- “Nickname” is a new user-profile attribute persisted server-side.
- The field is required for new registrations.
- Minimal UI/API changes beyond registration are preferred.
- No immediate change to how names are displayed elsewhere unless specified.

**Constraints**
- Minimize impact and avoid unrelated refactors.
- Deliver a self-contained, finished outcome (UI, API, data, tests).
- Align with existing validation and i18n patterns.
- Backward compatibility must be considered for existing APIs/clients.

**Unknowns**
- Uniqueness: Must nicknames be globally unique?
- Validation: Allowed characters, length min/max, profanity/emoji handling.
- Editability: Can users change nickname after signup? Frequency/rules?
- Visibility: Publicly displayed vs internal-only.
- Data model: Existing field (e.g., displayName/handle) vs new column?
- Migration: Strategy for existing users lacking a nickname.
- i18n: Final label/placeholder copy and supported locales.
- External auth: Behavior for SSO/social login flows.
- API contract: Field name (`nickname` vs `displayName`), request/response shape, versioning.

## Clarifying questions
- Should nicknames be unique across all users? If yes, is comparison case-insensitive and Unicode-normalized?
- What are the validation rules (min/max length, allowed characters, profanity checks, emoji support)?
- Can users change their nickname later? If so, are there rate limits or audit requirements?
- Is the nickname intended to be publicly visible and used in UI, or internal only for now?
- Do we already have a similar field (e.g., `displayName`) that should be reused instead of adding `nickname`?
- How should we handle existing users without a nickname (migration default, prompt on next login, forced modal, or admin backfill)?
- For SSO providers, should we prefill from provider attributes (e.g., `nickname`, `name`) and still require confirmation?
- What is the exact API field name and where should it appear in requests/responses? Any API versioning concerns?
- Are there accessibility or localization requirements for the new input’s label, help text, and validation messages?

**Residual Risks**
- Enforcing uniqueness or strong validation may block registrations without clear UX.
- Divergence between client/server validation could cause inconsistent errors.
- Migration for existing users may require user prompts and can disrupt flows.
- Confusion if an existing “username/display name” concept already exists and overlaps with “nickname.”