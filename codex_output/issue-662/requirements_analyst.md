**Functional Requirements**
- Click option selects it and immediately closes the panel.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Arrow-key navigation unchanged; Enter selects and closes; Escape closes without selection change.
- Outside click closes without forcing focus back to the trigger.
- Disabled options do not select and do not close the panel.
- Multi-select and native `<select>` behavior remains unchanged.

**Non-Functional Requirements**
- Minimal, localized UI-only change (or confirmation if already compliant).
- No API/dependency changes; preserve existing accessibility roles/states.
- Maintain current performance and keyboard behavior.
- Keep impact limited to custom single-select.

**Out Of Scope**
- Multi-select auto-close changes.
- Native `<select>` behavior changes.
- Overlay/portal refactors, search/typeahead, or UI redesigns.
- Backend/API modifications.

**Assumptions**
- A custom single-select controls its own panel and focus.
- Escape and outside-click close behaviors already work.
- Disabled options (if present) should neither select nor close.
- Focus returns to the trigger after intentional close is the desired UX.

**Risks**
- Blur vs click sequencing races in some browsers; may require event-order tuning if observed.
- If the panel is portaled/overlaid later, outside-click containment may need adjustment.
- If option labels include rich HTML, sanitization/escaping must prevent XSS.
- If selection triggers server actions, enforce server-side validation/allowlisting and CSRF protections.
- Potential mismatch in this repo snapshot if the actual component differs from prior artifacts.

## Clarifying questions
- Which component/file implements the target selector in this snapshot?
- Is the options panel rendered inline or via an overlay/portal?
- Should Space also select and close in single-select mode?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Are there tests or analytics tied to the current behavior/timing that must remain stable?