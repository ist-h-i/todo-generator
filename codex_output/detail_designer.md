**Objective**
- Stack subtask card “status” above “content” in the board view, replacing the current horizontal layout with a vertical stack at all breakpoints.

**Scope & Constraints**
- Only the subtask card container on the board screen.
- Layout-only change; no data, copy, or logic changes.
- Minimal, utility-class update using Tailwind.
- Preserve accessibility and keyboard/screen-reader order.

**Targets (Expected)**
- Angular template within `frontend/src/app/features/board/*` for the subtask card component.
- Container currently using `flex items-start justify-between gap-2` that wraps “status” and “content”.

**Layout Design**
- Replace `flex items-start justify-between gap-2` with `flex flex-col items-start gap-2`.
- Remove `justify-between` (not applicable for column direction).
- Ensure status appears before content in the DOM to keep visual and semantic order aligned.
- Keep existing truncation/wrapping classes on content (e.g., `truncate`, `line-clamp-*`, `break-words`) to avoid disclosing extra text.

**Accessibility**
- DOM order: status element first, content second.
- No `order-*` utilities unless reordering the DOM is impossible; semantic order should match visual order.
- Maintain focusability and roles; avoid adding ARIA unless needed.

**Interfaces**
- No changes to component inputs/outputs or services.
- If a wrapper/test id exists, keep it unchanged (e.g., `data-testid="subtask-card"`).
- No style globals; changes remain in the subtask card template.

**Failure Handling**
- If the class string is shared outside the subtask card:
  - Confirm the component is not reused elsewhere; otherwise, apply a wrapper class on the subtask card root (e.g., `subtask-card`) and scope the layout change locally.
- If older Safari lacks flex `gap` support:
  - Add a minimal fallback spacing on the status element (e.g., `mb-2`) within this component only.

**Trade-offs**
- Flex column vs. Grid: `flex flex-col` is simpler and consistent with existing utilities.
- CSS reordering vs. DOM reordering: prefer DOM reordering to preserve accessibility.
- Global style override vs. local change: local template/class change avoids unintended side effects.

**Implementation Steps (Scoped)**
- Locate the subtask card template in `features/board`.
- Update the container classes from `flex items-start justify-between gap-2` to `flex flex-col items-start gap-2`.
- Ensure status markup precedes content in the DOM.
- Verify long-content rendering retains truncation/wrapping behavior.

**Test Impact**
- Snapshot/DOM-order tests may need updates if they assume previous order; prefer querying by role/label/test id over index.
- No changes to e2e flows unless they assert relative positions.

**Risks & Mitigations**
- Unintended reuse: limit the change to the specific template; add a component wrapper if necessary.
- Height changes affecting drag-and-drop: visually verify list virtualization/drag targets; keep truncation intact.
- Spacing regressions: confirm `gap-2` is equivalent to prior spacing; if not, adjust to `gap-1` or `gap-3` per UI review.

**Rollback Plan**
- Revert the class change to the original `flex items-start justify-between gap-2`.
- Restore original DOM order if modified.

**Done Criteria**
- Subtask cards show status on top, content below, at all breakpoints.
- Left alignment and consistent spacing maintained.
- No unintended layout changes elsewhere; tests/lint/format pass.