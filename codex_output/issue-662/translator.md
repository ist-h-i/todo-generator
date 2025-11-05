**English Restatement**
Change the custom single-select so that when a user clicks an option, the options panel closes immediately. Preserve existing keyboard and dismissal behavior. Multi‑select and native `<select>` are out of scope.

**Objectives / Definition of Done**
- Option click applies selection and closes the panel immediately.
- Focus returns to the trigger after an intentional close (click/Enter/Escape).
- Keyboard: Arrow navigation unchanged; Enter selects and closes; Escape closes without selection.
- Outside click closes without forcibly moving focus.
- Multi‑select/native `<select>` behavior remains unchanged.

**In Scope**
- Custom single‑select option click → select + close + focus restore.

**Out of Scope**
- Multi‑select auto‑close changes.
- Native `<select>` behavior changes.
- Overlays/portals, search/typeahead, or broader redesigns.
- Backend/API changes.

**Constraints**
- Minimize changes and avoid creating unnecessary tasks.
- Deliver a finished, self‑contained outcome with minimal project impact.
- No dependency or API surface changes.

**Assumptions**
- There is a custom single‑select component controlling its own panel and focus.
- Existing ESC and outside‑click closing behaviors already work and should be preserved.
- Disabled options (if any) should neither select nor close the panel.
- Prior stage artifacts suggest the behavior may already be compliant; verification will confirm.

**Unknowns**
- Exact file/component path for the target selector in this repo snapshot.
- Whether Space should also select/close for keyboard parity with native controls.
- Presence of disabled options and desired behavior on click.
- Whether the panel is rendered inline vs via portal/overlay (affects outside‑click logic).
- Any tests or analytics relying on current behavior.

**Residual Risks / Open Questions**
- Blur vs click event ordering could cause rare race conditions; may need careful sequencing only if observed.
- Space key parity with Enter may be expected by some users.
- If panel rendering moves to a portal/overlay, outside‑click containment might need adjustment.
- If option labels ever include rich HTML, ensure escaping/sanitization to prevent XSS.
- If selection triggers server actions, ensure server‑side validation/allowlisting and CSRF protections.

## Clarifying questions
- Which component/file implements the target selector in this repository snapshot?
- Should the Space key also select and close in single‑select mode?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Is the panel rendered inline or via an overlay/portal?
- Are there tests/analytics tied to current timing that we should keep stable?