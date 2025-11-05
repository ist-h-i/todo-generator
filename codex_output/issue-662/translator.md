**Summary**
- Update the custom single-select so the options panel closes immediately when an option is clicked. Preserve existing behavior for keyboard and dismissal interactions. Multi-select and native `<select>` are out of scope.

**Assumptions**
- Target is a custom single-select component (not native).
- Focus should return to the trigger after an intentional close.
- Existing ESC and outside-click-to-close behaviors remain.
- Multi-select/native variants retain their current behavior.

**Constraints**
- Minimal, localized change; avoid broad refactors.
- No API/dependency changes.
- Maintain accessibility (roles/states, focus management).
- Deliver a finished, self-contained outcome.

**Acceptance Criteria**
- Click on option → select value and close panel immediately.
- Focus returns to the trigger after this close.
- Enter on active option selects and closes; ESC and outside-click close remain unchanged.
- Multi-select/native `<select>` behavior unchanged.

**Unknowns**
- Exact component/file path in this repo snapshot (referenced path may not exist here).
- Whether Space should also select/close for parity with native controls.
- Presence of embedded search/typeahead in the panel that might affect close timing.
- Handling for disabled options (should not select/close).

**Residual Risks / Open Questions**
- Blur vs click event ordering could cause rare race conditions; may require careful sequencing (only if observed).
- Space key parity with Enter is unspecified; expectations may vary.
- Outside-click containment may change if the panel is portaled/overlaid later.
- If option labels ever include rich HTML, ensure sanitization/escaping to avoid XSS.
- If selection triggers server-side effects, confirm server validation/allowlisting and CSRF protections.
- Global listener cleanup to avoid leaks (document click handlers).

**Clarifying Questions**
- Which component/file implements the target selector in this repository snapshot?
- Should Space also select/close in single-select mode?
- Is there a search/typeahead inside the panel to consider for close timing?
- Are there disabled options and should clicks on them be ignored without closing?
- Confirm scope: custom single-select only; multi-select/native remain unchanged.