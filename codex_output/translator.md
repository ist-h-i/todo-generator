**Summary**
- Bug: In the competency registration form, the “Level” select shows no options.
- Objective: Restore the level options so users can select and submit a valid level.

**Assumptions**
- The app is an Angular SPA; the “Level” field uses a shared select component.
- Level options are static (design/constant) or otherwise already available client-side.
- The issue is frontend-timing related (projected options not detected) rather than backend data emptiness.

**Constraints**
- Minimal, localized change; avoid unrelated edits.
- Deliver a self-contained, ready-to-merge fix with no API/template contract changes.
- Preserve existing UX, form bindings, and accessibility.

**Known Context**
- Prior analysis suggests the shared select component reads projected `<option>`s only once and misses later insertions; observing DOM changes and deferring the initial read likely resolves it.
- Other pages using the same select may also benefit from the fix.

**Acceptance Criteria**
- “Level” dropdown consistently renders expected options.
- User can open the dropdown, navigate options (mouse/keyboard), select a value, and the form reflects/submits it.
- No console errors; no regression in other pages using the select.
- Basic a11y preserved (focus, ARIA roles, keyboard interaction).

**Non-Goals**
- No redesign or dependency changes.
- No backend or API contract changes.
- No global refactors beyond the shared select’s minimal stabilization.

**Unknowns**
- Exact source of “Level” options (purely static vs. async-inserted).
- Specific component/template rendering the field.
- Whether the issue reproduces across all environments or only certain builds.

**Clarifying Questions**
- Are “Level” options strictly static in the template, or can they be added/translated asynchronously?
- Which component/template renders the competency registration form and “Level” field?
- Do any console or network errors appear when opening the form?
- Is this regression recent, tied to a change in the shared select component or rendering lifecycle?
- Should we verify any other forms using the same select for parity?

**Residual Risks / Open Questions**
- If options rely on translations, missing i18n keys could still yield blank labels.
- If options are intended to come from an API and that API returns empty, the UI fix won’t surface choices.
- SSR/hydration contexts may require guarding DOM observers to browser-only execution.