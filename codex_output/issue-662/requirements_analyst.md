**Functional Requirements**
- Clicking an option selects it and immediately closes the panel.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Arrow-key navigation unchanged; Enter selects and closes; Escape closes without selection change.
- Outside click closes without forcing focus back to the trigger.
- Disabled options do not select and do not close the panel.
- Multi-select and native `<select>` behavior remains unchanged.

**Non-Functional Requirements**
- Minimal, localized UI-only change (or confirm existing compliance); no API/dependency changes.
- Preserve accessibility roles/states and existing focus management.
- Maintain current keyboard behavior and performance characteristics.

**Out of Scope**
- Changes to multi-select auto-close or native `<select>`.
- Overlay/portal refactors, search/typeahead, or broader redesigns.
- Backend/API modifications.

**Assumptions**
- A custom single-select component controls its panel and focus.
- Escape and outside-click closing behaviors already work.
- UX expects focus to return to the trigger after intentional close.
- Disabled options (if any) should neither select nor close.

**Residual Risks / Open Questions**
- Blur vs click event sequencing races in some browsers.
- Space key parity with Enter is unspecified.
- If panel rendering moves to a portal/overlay, outside-click containment may need adjustment.
- If option labels include rich HTML, require proper escaping/sanitization to avoid XSS.
- If selection triggers server actions, server-side validation/allowlisting and CSRF protections must be enforced.

## Clarifying questions
- Which component/file implements the target selector in this repository snapshot?
- Should Space also select and close in single-select mode?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Is the options panel rendered inline or via an overlay/portal?
- Are there tests or analytics tied to the current behavior/timing that must remain stable?