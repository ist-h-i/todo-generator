**Summary**
- Requirement is clear and minimal: in custom single‑select, clicking an option must immediately close the options panel and return focus to the trigger. Multi‑select and native `<select>` are out of scope.

**Scope**
- In: Custom single‑select option click behavior and focus management on intentional close.
- Out: Multi‑select auto‑close, native `<select>` changes, overlay/portal refactors, backend/API changes.

**Acceptance Criteria**
- Click option → selection applies, panel closes immediately.
- Intentional close (click/Enter/Escape) → focus returns to trigger.
- Arrow‑key navigation unchanged; Enter selects and closes.
- Escape closes without selection change.
- Outside click closes without forcing focus back.
- Disabled options neither select nor close the panel.
- Multi‑select/native `<select>` behaviors unchanged.

**Non‑Functional**
- Minimal, localized UI change (or confirmation only).
- No dependency/API surface changes.
- Preserve accessibility roles/states and current keyboard behavior.

**Ambiguities / Missing Details**
- Component path for the target selector in this repo snapshot not explicitly confirmed.
- Space key behavior unspecified (whether it should mirror Enter for selection/close).
- Presence and expected behavior for disabled options on click (assumed “ignore and stay open”).
- Rendering model (inline vs overlay/portal) not stated; affects outside‑click containment.

**Validation Plan**
- Manual checks:
  - Open → click option → value updates, panel closes, focus returns to trigger.
  - Arrow keys to option + Enter → selection and close.
  - Press Escape → closes; selection unchanged; focus returns to trigger.
  - Click outside → closes; focus not forcibly moved.
  - Click a disabled option → no selection change; panel stays open.
  - Multi‑select/native paths behave unchanged.

**Residual Risks / Open Questions**
- Blur vs click sequencing races (rare, browser‑specific); only adjust event ordering if observed.
- If panel moves to a portal/overlay later, re‑validate outside‑click containment.
- If option labels can include rich HTML, ensure continued escaping/sanitization.
- If selection triggers server actions, enforce server‑side validation/allowlisting and CSRF protections.
- Please confirm:
  - The exact component/file path implementing the selector in this snapshot.
  - Whether Space should also select/close in single‑select mode.
  - Expected behavior for disabled options on click (confirm ignore/no close).
  - Inline vs overlay/portal rendering for the options panel.
  - Any tests/analytics tied to the current close timing that must remain stable.