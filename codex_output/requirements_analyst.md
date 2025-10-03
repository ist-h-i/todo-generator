**Summary**

- Change subtask card layout on the Board view so the Status appears above the Content within the container currently using `flex items-start justify-between gap-2`. No other visual changes.

**Scope**

- Only subtask cards on the Board view.
- Only the container currently laid out with `flex items-start justify-between gap-2`.

**Functional Requirements (FR)**

- Display order: Status above Content (vertical stack).
- Apply vertical stacking at all breakpoints unless specified otherwise.
- Preserve existing text, interactions, and data bindings.
- Maintain current spacing scale unless otherwise directed (keep gap ~ `gap-2`).

**Non-Functional Requirements (NFR)**

- Accessibility: Reading/tab order reflects visual order (Status before Content).
- Responsiveness: Layout remains stable across common breakpoints without overlapping or overflow.
- Consistency: No layout regressions to non-subtask cards or other views.
- Maintainability: Implement with minimal change (e.g., Tailwind utilities, no refactors).

**Acceptance Criteria**

- On the Board view, each subtask card shows Status stacked above Content inside the affected container.
- The container uses a vertical layout (e.g., `flex-col`) and the visual order matches DOM order.
- Spacing between Status and Content equals or closely matches current `gap-2`.
- `justify-between` is not used to create vertical gaps; stacking is compact and aligned to start.
- No visual change to other elements outside this subtask container.
- No change to behavior of status controls (badges/selects) or content fields (text wrapping works as before).
- Works on mobile, tablet, and desktop without overflow or clipping.

**Constraints & Assumptions**

- Tailwind CSS utilities are available; change likely limited to utility classes (e.g., add `flex-col`, remove `justify-between`).
- Status refers to the subtask status control/indicator; Content refers to title/description block.
- No typography or spacing scale changes beyond stacking.
- Applies to all breakpoints unless a design specifies exceptions.

**Out of Scope**

- Changing styles, colors, or component behavior.
- Refactoring component structure beyond the target container.
- Modifying non-subtask cards or other views.

**Risks**

- Unintended impact if the same container/class is reused outside subtask cards.
- `justify-between` removal may affect vertical spacing if other elements are present.
- DOM order changes could affect automated tests or selectors.

**Mitigations**

- Target the specific subtask card component/template only.
- Verify element list inside the container before removing `justify-between`; adjust with `gap-*` or `space-y-*` if needed.
- Smoke-test Board view and scan for selector dependencies.

**Open Questions**

- Exact file/component for the subtask card on the Board view?
- Should stacking apply at all breakpoints, or only below a certain width?
- Keep `gap-2` as-is, or adjust spacing?
- Confirm removal of `justify-between` and use `justify-start` for compact stacking?
- Any other elements in the same container needing specific order?
- Any design mockups/screenshots to confirm spacing/alignment?
- Any UI tests/visual snapshots that could be affected?