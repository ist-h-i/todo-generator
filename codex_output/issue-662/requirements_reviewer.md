**Summary**
- Requirement is clear and minimal: in the custom single-select, clicking an option should immediately close the options panel while restoring focus to the trigger. Multi‑select and native `<select>` are out of scope.

**Scope**
- In scope: custom single‑select option click behavior, focus management on intentional close.
- Out of scope: multi‑select auto‑close, native `<select>`, overlay/portal refactors, search/typeahead, backend/API changes.

**Acceptance Criteria**
- Option click applies selection and closes the panel immediately.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Keyboard: Arrow navigation unchanged; Enter selects and closes; Escape closes without selection change.
- Outside click closes without forcibly moving focus.
- Disabled options do not select and do not close the panel.
- Multi‑select/native `<select>` behavior remains unchanged.

**Non‑Functional**
- No dependency or API surface changes.
- Preserve accessibility roles/states and current keyboard interactions.
- Keep changes minimal and localized (or confirm no change if already compliant).

**Gaps / Potential Conflicts**
- Space key behavior is unspecified; decide whether Space should also select/close in single‑select for parity with native controls.
- Component/file path for the target selector in this repo snapshot is not explicitly confirmed; verify the actual component to ground acceptance.
- Disabled option behavior is called out here; confirm expectation if not already defined.
- If the panel is rendered via a portal/overlay, outside‑click containment logic may differ.

**Test Scenarios (DoD Validation)**
- Open → click option → selection applies, panel closes, focus returns to trigger.
- Arrow keys to option + Enter → selection applies and closes.
- Press Escape while open → closes; selection unchanged; focus returns to trigger.
- Click outside → closes; focus not forcibly moved.
- Click a disabled option → no selection change; panel stays open.
- Multi‑select/native paths → unchanged behavior.

**Residual Risks / Open Questions**
- Space key parity: should Space also select/close in single‑select?
- Confirm target component/file path in this snapshot to validate behavior.
- Rare blur vs click ordering races (only address if observed; avoid preemptive changes).
- Future overlay/portal rendering could require revisiting outside‑click containment.
- If option labels can include rich HTML, ensure continued escaping/sanitization.
- If selection triggers server actions, ensure server‑side validation/allowlisting and CSRF protections.