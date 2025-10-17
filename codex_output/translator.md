**Summary**
- Bug: During competency registration, the “level” selection shows no options. Needs a fix with minimal project impact and a self-contained outcome.

**Goal**
- Restore the competency “level” options so users can select a valid level during registration.

**Assumptions**
- The competency registration form is part of the Angular SPA.
- “Level” options are either static (enum/design system constant) or fetched from an API.
- The issue is a regression affecting all users in the affected environment.

**Constraints**
- Avoid unrelated changes; keep the fix small and localized.
- Deliver a complete, ready-to-merge fix (UI + data wiring + tests if applicable).

**Unknowns**
- Source of the options (static vs API).
- Whether the issue is frontend-only (binding/component config) or backend/API (empty response).
- Exact component/module handling the level field.
- Scope (all competencies vs specific cases; all environments vs one).

**Acceptance Criteria**
- Level options render consistently in the registration form.
- Options match the source of truth (enum or API).
- Selection persists correctly in form state and submission.
- No console errors; API calls (if any) succeed and are handled (loading/empty/error).
- Basic accessibility is preserved (focusability, labels, keyboard interaction).

**Clarifying Questions**
- What is the expected source of level options (static list or API endpoint)? If API, which endpoint and expected payload?
- Is the issue reproducible across all environments (dev/staging/prod)? Any environment-specific flags or feature toggles?
- Are there recent changes to the select component, state management, or API that could have caused this?
- Do you see errors in the browser console or network panel when opening the form?
- Which Angular component/file renders the level field?
- What are the expected option values/labels and order?
- Should we add/update tests (unit/e2e), and where are current tests located?

**Residual Risks**
- If the root cause is backend data or contract drift, frontend-only fixes may mask deeper issues.
- If options are translated, missing i18n keys could still result in blank labels.
- If the design system select component recently changed API/inputs, other forms may be affected and require follow-up.