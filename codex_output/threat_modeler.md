**Key Threats**

- Unintended scope impact
  - Risk: The class string `flex items-start justify-between gap-2` may appear in multiple components; changing it globally or in a shared component could alter layouts across the app.
  - Mitigation: Locate the subtask card template in the board feature and change classes only there. Verify it’s not a shared/reused component.

- Accessibility/keyboard order mismatch
  - Risk: Using CSS `order-*` to flip visual order may leave DOM order unchanged, causing screen readers and keyboard navigation to read “content” before “status”.
  - Mitigation: Place the status element before content in the DOM. Avoid relying on `order-*`. If reordering is impossible, add appropriate ARIA relationships (e.g., `aria-describedby`) to preserve semantics.

- Snapshot/test fragility
  - Risk: DOM order and structure changes can break unit/snapshot/E2E tests that assume the previous order or query by index.
  - Mitigation: Update tests to query by role/label/testid rather than position. Validate affected tests locally and adjust selectors to be resilient.

- Virtualization/height-dependent layout
  - Risk: Boards sometimes assume near-fixed item heights for virtualization or consistent drag-and-drop hit areas; vertical stacking can increase card height and cause layout jank.
  - Mitigation: Confirm whether lists use virtualization/drag-and-drop relying on item height. Validate performance and pointer targets after the change. If needed, constrain content wrapping/truncation to maintain predictable heights.

- Content overflow and wrapping
  - Risk: Long content may overflow or create excessive vertical space once stacked; existing truncation might not apply.
  - Mitigation: Ensure content retains prior wrapping/truncation (`truncate`, `line-clamp`, or `break-words`) behavior. Visually validate long-text cases.

- Spacing and alignment regressions
  - Risk: Removing `justify-between` with `flex-col` changes spacing logic; child widths may collapse or misalign if relying on horizontal distribution.
  - Mitigation: Use `flex flex-col items-start gap-2`. Verify children widths; add `w-full` on content if necessary to match card width. Check no `space-x-*` remnants affect layout.

- Cross-browser flex-gap support
  - Risk: `gap` in flex containers is unsupported in some older Safari versions; vertical spacing could disappear.
  - Mitigation: If supporting older Safari, confirm current usage already relies on flex `gap`. If not supported, add minimal fallback spacing class on children (e.g., `mb-2` on status) within the component.

**Critical Flows Affected**

- Board rendering and interaction: Item heights, drag/drop targets, and scroll performance.
- Keyboard and screen-reader navigation: Reading order and focus traversal within cards.
- Test stability: DOM order-dependent queries and snapshots.

**Mitigation Plan (Minimal, Scoped)**

- Update only the subtask card container to `flex flex-col items-start gap-2`; remove `justify-between`.
- Ensure status precedes content in the DOM to align visual and accessible order.
- Validate long-content wrapping and heights; keep existing truncation/wrapping utilities.
- Run and adjust affected unit/snapshot/E2E tests to query semantically, not by position.
- Visual pass on the board for multiple breakpoints; confirm no regressions in other cards.
- If necessary for legacy Safari, add a component-scoped spacing fallback.

**Assurance Activities**

- Local visual check on the board with varied content lengths.
- Lint/format/tests run clean; update only impacted tests.
- Quick a11y check: keyboard tab order and screen reader reading sequence (status first).