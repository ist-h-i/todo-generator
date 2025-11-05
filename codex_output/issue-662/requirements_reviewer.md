**Summary**
- Goal is clear and minimal: in the custom single-select, close the options panel immediately upon option click, without changing multi-select or native `<select>` behaviors.

**Scope**
- In scope: custom single‑select only.
- Out of scope: multi‑select behavior, native `<select>`, overlays/portals, search/typeahead additions, backend/API changes.

**Acceptance Criteria**
- Option click selects the value and closes the panel immediately.
- After intentional close (click/Enter/Escape), focus returns to the trigger.
- Keyboard: Arrow navigation preserved; Enter selects and closes; Escape closes (no selection change).
- Outside click closes the panel and does not forcibly move focus to the trigger.
- Disabled options: clicking a disabled option must not change selection or close the panel.
- Multi‑select/native `<select>` behavior remains unchanged.

**Non‑Functional / A11y**
- Maintain ARIA roles/states (e.g., listbox/option, `aria-selected`).
- Preserve current outside‑click and ESC handling; no regressions in keyboard navigation.
- No dependency or API surface changes.

**Edge Cases to Capture**
- Blur vs click ordering: avoid races that prevent selection from applying before close.
- Async/late-loaded options: ensure label/value remain consistent when panel closes.
- Very small viewports and scrollable panels: closing should not trap focus or scroll unexpectedly.

**Conflicts/Gaps**
- Space key behavior unspecified; decide whether Space should select/close like Enter.
- Disabled-option behavior not explicitly stated before; added AC above for clarity.
- Component/file path uncertainty in this snapshot; confirm the actual selector component to verify behavior with confidence.

**Definition of Done**
- Behavior matches all AC in single‑select mode.
- No changes to multi‑select/native paths.
- A11y/focus behavior validated manually.
- Short release note describing the interaction timing and scope.

**Verification Checklist**
- Open → click option → selection applied, panel closes, focus returns to trigger.
- Arrow keys to item + Enter → selection applied, panel closes, focus returns to trigger.
- Press ESC while open → closes; focus returns to trigger; selection unchanged.
- Click outside → closes; focus not forcibly moved.
- Click a disabled option → no selection change; panel stays open.
- Multi‑select/native `<select>` → unchanged behavior.

**Residual Risks / Open Questions**
- Space key parity with Enter: do we also close on Space?
- If the panel is later rendered via a portal/overlay, re‑validate outside‑click containment.
- If option labels ever include rich HTML, ensure sanitization/escaping to avoid XSS.
- If selection triggers server actions, confirm server‑side validation/allowlisting and CSRF protections.
- Confirm the exact component/file path in this repository snapshot to ground verification.