**Scope**

- Board subtask cards only; verify stacked layout in `frontend/src/app/features/board/page.html:261`.
- No behavioral changes; DOM order and Tailwind classes only.

**What To Verify**

- Container uses `flex flex-col items-start justify-start gap-2`; no `justify-between`.
- DOM order: Status element (column title) appears before Content (subtask title).
- Spacing between Status and Content approximates `gap-2`.
- Other card parts remain unchanged (drag handle, labels, parent info, compact/highlight classes).

**Automated Tests**

- Unit (Karma/Jasmine, Angular TestBed)
  - Render `BoardPage` with a minimal mock `WorkspaceStore` that yields one column with one subtask.
  - Query the first `.subtask-card` container at `frontend/src/app/features/board/page.html:261`:
    - Assert class list contains `flex`, `flex-col`, `items-start`, `gap-2`.
    - Assert class list does not contain `justify-between`.
    - Assert first child is a `span` containing the column title (status), second is an `h4` containing the subtask title.
  - Regression checks:
    - `.subtask-card` still has `cdkDrag`.
    - `.subtask-card--compact` toggles based on resolved status.
    - `.subtask-card-labels` section still renders after the header stack.

- Contract/Rendering
  - Verify safe interpolation remains (no `[innerHTML]`) for `subtask.title` and `column.title`.
  - Verify long titles wrap (`min-w-0 break-words`) and do not overflow the card container.

- Non-Functional
  - Accessibility: DOM order equals visual order (status then content).
  - Responsiveness: Because `flex-col` is unconditional, assert its presence rather than viewport-size behavior.

**Suggested Test Locations**

- Add `frontend/src/app/features/board/page.spec.ts` beside the component.
- Prefer stable queries by structure:
  - Container selector: `.subtask-card > div.flex`
  - Status node: firstElementChild `HTMLSpanElement`
  - Content node: secondElementChild `HTMLHeadingElement`

**Test Data**

- One status column titled “進行中” with one subtask titled “サブタスクA” (and one resolved subtask for compact-mode check).
- Minimal label/parent fields to satisfy template.

**Pass/Fail Gates**

- Pass if:
  - Classes exactly match vertical stack requirements and exclude `justify-between`.
  - DOM order is status then content.
  - No regressions to adjacent elements and attributes.
- Fail if:
  - Horizontal layout persists, `justify-between` remains, or DOM order reversed.
  - Drag-and-drop or labels/parent info regress.

**CI/Quality**

- Run `npm test -- --watch=false` and `npm run lint` in frontend.
- No new frameworks; keep Karma/Jasmine.
- Optional: enable coverage in CI with `npm run test:ci`; target ≥80% line coverage for the new spec file.

**Risks & Mitigations**

- Selector brittleness: Query by structure (first `div.flex` inside `.subtask-card`) to avoid class string drift.
- Shared patterns: Tests are scoped to Board `page.ts` template to avoid coupling to other views.