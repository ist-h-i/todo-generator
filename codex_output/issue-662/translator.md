**English Restatement**
Change the custom single-select so that when a user clicks an option, the options panel closes immediately and focus returns to the trigger. Keep keyboard and dismissal behavior unchanged. Multi-select and native `<select>` are out of scope.

**Objectives / Definition of Done**
- Clicking an option selects it and immediately closes the panel.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Arrow-key navigation unchanged; Enter selects and closes; Escape closes without selection change.
- Outside click closes without forcing focus back.
- Disabled options do not select and do not close the panel.
- Multi-select/native `<select>` behavior remains unchanged.

**In Scope**
- Custom single-select: option click → select + close + focus restore.

**Out of Scope**
- Multi-select auto-close changes.
- Native `<select>` behavior changes.
- Overlays/portals refactors, search/typeahead, or broader redesigns.
- Backend/API changes.

**Assumptions**
- A custom single-select component controls its own panel and focus.
- Existing Escape and outside-click close behaviors already work.
- Disabled options (if any) should neither select nor close.
- Current UX expects focus to return to the trigger after intentional close.

**Constraints**
- Minimize changes and avoid creating unnecessary tasks.
- Deliver a finished, self-contained outcome with minimal project impact.
- No dependency or API surface changes; localized UI logic only.

**Unknowns**
- Exact component/file path of the target selector in this repository snapshot.
- Whether Space key should also select/close for parity with native controls.
- Whether the panel renders inline vs via overlay/portal (affects outside-click logic).
- Presence and expected behavior of disabled options on click.
- Any tests/analytics relying on current close timing.

**Residual Risks / Open Questions**
- Blur vs click sequencing races in some browsers; may require careful event ordering if observed.
- If future rendering moves the panel to a portal/overlay, outside-click containment may need adjustment.
- If option labels ever include rich HTML, ensure continued escaping/sanitization to prevent XSS.
- If selection triggers server actions, server-side validation/allowlisting and CSRF protections must remain enforced.

## Clarifying questions
- Which component/file implements the target selector in this snapshot?
- Should Space also select and close in single-select mode?
- Do disabled options exist, and should clicks on them be ignored without closing?
- Is the options panel rendered inline or via an overlay/portal?
- Are there tests or analytics tied to the current behavior that must remain stable?