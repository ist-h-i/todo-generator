**Summary**
- Show a user’s nickname wherever a “name” is displayed; fall back to email only when nickname is not set.

**Acceptance Criteria**
- When rendering a user’s display name: if `nickname` exists and is non-empty after trim, show it; else show `email`.
- Apply consistently across all user-facing views/components (lists, headers, profile, activity, comments, etc.).
- Do not change displays that explicitly require the email (e.g., auth forms, security pages).
- No functional regressions; visual snapshots (if any) updated accordingly.

**Assumptions**
- User entity includes `email` (always present) and `nickname` (optional).
- `nickname` may be `null`, `undefined`, empty string, or whitespace.
- No backend schema change is needed; this is a presentation-layer rule.

**Constraints**
- Minimize impact and avoid unnecessary tasks.
- Keep changes localized (prefer a single utility/helper as a source of truth).
- Do not modify APIs or database unless strictly necessary.
- Maintain i18n and existing accessibility semantics.

**Unknowns**
- Exact field names (`nickname`, `displayName`, `handle`?) and types in the current codebase.
- Are there views intentionally showing email even when nickname exists (e.g., admin tables)?
- Any caching/memoization layers that compute display names?
- Cross-tenant contexts where email must be shown for disambiguation.
- Sorting/grouping behavior: if lists sort by “name,” should sorting use nickname or email?

**Clarifying Questions**
- What are the exact user model fields for nickname and email?
- Are there screens where email must still be shown even if nickname exists (admin, audit, notifications)?
- Should sorting/search use nickname primarily as well?
- How should we treat nicknames equal to the email (e.g., user set email as nickname)?
- Any constraints for system users/integrations without emails?

**Out of Scope**
- Adding or changing nickname edit flows.
- Backend schema changes or migrations.
- Broader UI redesigns.

**Residual Risks**
- Inconsistent logic if some components bypass the shared helper.
- Edge cases with whitespace-only nicknames causing unexpected blanks.
- Potential confusion in contexts where email is expected for identification (support/admin).