**Summary**
- Change the selector so the options panel closes immediately when the user clicks an option (single-select scope).

**Assumptions**
- Target is a custom single-select component (not native `<select>`).
- Multi-select/native variants, if present, should keep existing behavior (do not auto-close on each selection).
- Focus should return to the trigger after an intentional close.

**Constraints**
- Minimal change, no broad UI/UX refactors.
- Preserve accessibility: ESC/outside-click close, ARIA roles/states, and focus management.
- Keep keyboard behavior consistent; Enter should mirror click.

**Unknowns**
- Exact component/file path of the selector in this repo snapshot.
- Whether Space key should also select/close for parity with native controls.
- Whether a search/typeahead exists inside the panel that could be affected by close timing.

**Acceptance Criteria**
- Clicking an option selects it and closes the panel.
- Focus returns to the trigger after selection close.
- Keyboard Enter selects and closes; ESC and outside-click close remain unchanged.
- Multi-select/native paths remain unchanged.

**Residual Risks / Open Questions**
- Blur vs click ordering in some browsers can interfere; may require careful event ordering if observed.
- If options contain rich HTML now or in the future, ensure labels remain sanitized/escaped.
- If selection triggers server-side changes, confirm server validation/allowlisting and CSRF protection.

**Clarifying questions**
- Which component/file implements the selector to target with this change?
- Should Space also select/close in single-select for keyboard parity?
- Do we need to handle any embedded search/typeahead within the panel?
- Confirm scope: single-select only, with multi-select/native unaffected?