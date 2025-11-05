**Issue Summary**
- Change timing so the custom single-select closes its options panel immediately upon clicking an option. Preserve keyboard and dismissal behavior. Multi-select and native `<select>` are out of scope.

**Functional Requirements**
- Clicking an option immediately selects it and closes the panel.
- After intentional close, focus returns to the trigger.
- Enter on the active option selects and closes.
- ESC and outside-click still close (no change).
- Multi-select/native `<select>` behavior remains unchanged.

**Non-Functional Requirements**
- Minimal, localized changes only; no API/dependency updates.
- Maintain accessibility: roles/states, focus management, ESC handling.
- Avoid regressions to keyboard navigation and outside-click behavior.
- Deliver a finished, self-contained outcome.

**Out of Scope**
- Redesigns, portals/overlays, search/typeahead additions.
- Changing multi-select auto-close behavior.
- Backend or schema changes.
- Broad UI/UX refactors or copy changes.

**Assumptions**
- Target is a custom single-select component (non-native).
- Current ESC and outside-click handling already exist and should be preserved.
- Focus management can restore focus to the trigger on intentional close.
- Multi-select uses different path and should not auto-close on selection.

**Residual Risks / Open Questions**
- Event ordering (blur vs click) could cause rare race conditions; only adjust sequencing if observed.
- Space key parity with Enter is unspecified; users may expect Space to select/close.
- Outside-click containment can change if the panel is moved to a portal/overlay later.
- If option labels ever include rich HTML, ensure sanitization to avoid XSS.
- If selection triggers server-side effects, confirm server validation/allowlisting and CSRF protections.
- Component/file path mismatch risk in this repo snapshot; confirm the actual selector file to avoid unnecessary changes.

## Clarifying questions
- Which component/file implements the target selector in this repository snapshot?
- Should Space also select/close for keyboard parity with native controls?
- Is there any embedded search/typeahead inside the panel that could be affected by close timing?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Confirm scope: custom single-select only; multi-select/native paths unchanged?