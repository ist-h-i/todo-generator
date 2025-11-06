**English Restatement**
Change the custom single‑select so that when a user clicks an option, the options panel closes immediately and focus returns to the trigger. Keyboard and dismissal behaviors should remain consistent. Multi‑select and native `<select>` are out of scope.

**Objectives / Definition of Done**
- Clicking an option selects it and immediately closes the panel.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Arrow‑key navigation unchanged; Enter selects and closes; Escape closes without selection change.
- Outside click closes without forcing focus back to the trigger.
- Disabled options do not select and do not close the panel.
- Multi‑select and native `<select>` behavior remains unchanged.

**In/Out of Scope**
- In: Custom single‑select option click behavior and focus management on close.
- Out: Multi‑select auto‑close, native `<select>` behavior, overlay/portal refactors, broader UI redesigns, backend/API changes.

**Assumptions**
- A custom single‑select component controls its own panel and focus.
- Existing Escape and outside‑click close behaviors already work.
- Disabled options (if present) should neither select nor close.
- UX expects focus to return to the trigger after intentional close.

**Constraints**
- Minimize changes; avoid unnecessary tasks.
- Deliver a finished, self‑contained outcome with minimal project impact.
- No dependency or API surface changes; localized UI logic only.

**Unknowns**
- Exact component/file path of the selector in this repository snapshot.
- Whether the panel renders inline vs via overlay/portal.
- Whether Space should also select/close for keyboard parity with native controls.
- Presence and behavior of disabled options on click.
- Tests/analytics that rely on current close timing.

**Residual Risks / Open Questions**
- Blur vs click sequencing races in some browsers; may require careful event ordering.
- If panel rendering moves to a portal/overlay, outside‑click containment may need adjustment.
- If option labels include rich HTML, ensure continued escaping/sanitization to prevent XSS.
- If selection triggers server actions, server‑side validation/allowlisting and CSRF protections must remain enforced.

## Clarifying questions
- Which component/file implements the target selector in this snapshot?
- Is the panel rendered inline or via an overlay/portal?
- Should Space also select and close in single‑select mode?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Are there tests or analytics tied to the current behavior/timing that must remain stable?