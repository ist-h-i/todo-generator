# Docs Drafts: Board Subtask Card Layout (Status Above Content)

## README Update (Frontend UI)
Add under a “Board View → Subtasks” or similar section.

- Goal: Stack Status above Content within subtask cards on the Board.
- Layout:
  - Container uses `flex flex-col items-start justify-start gap-2`.
  - DOM order: Status element precedes Content element.
  - File reference: `frontend/src/app/features/board/page.html:261`
- Rationale:
  - Improves readability and aligns visual and tab/reading order for accessibility.
- Scope:
  - Board subtask cards only; no behavior changes.
- Verify:
  - Open Board; confirm Status text appears above the subtask title.
  - Confirm container includes `flex`, `flex-col`, `items-start`, `gap-2` and excludes `justify-between`.
- Quality checks:
  - `cd frontend && npm test -- --watch=false && npm run lint && npm run format:check && npm run build`

## CHANGELOG Entry
Add under the next release (or “Unreleased”).

- Changed: Board subtask cards now stack Status above Content using a vertical layout.
  - Implementation: Replaced horizontal flex with `flex flex-col items-start gap-2`; removed `justify-between`.
  - Accessibility: DOM and visual order now align (Status → Content).
  - Scope: Board view only.
  - Reference: `frontend/src/app/features/board/page.html:261`

## ADR (Draft)
File: `docs/adr/2025-10-03-board-subtask-status-on-top.md`

### Title
Stack Status Above Content in Board Subtask Cards

### Status
Accepted

### Context
Subtask cards on the Board showed Status and Content side-by-side in a `flex` row (`flex items-start justify-between gap-2`). The requirement is to stack Status above Content with minimal impact and consistent spacing.

### Decision
- Update the container to a vertical stack using Tailwind utilities:
  - `flex flex-col items-start justify-start gap-2`
- Ensure DOM order matches visual order (Status element before Content).
- Limit change scope to Board subtask cards.
- Reference: `frontend/src/app/features/board/page.html:261`

### Consequences
- Improved readability and accessibility (screen reader/tab order matches visual order).
- No behavioral changes; data bindings and interactions remain the same.
- Minimal layout risk contained to the subtask card area.

### Alternatives Considered
- CSS-only reordering via `order-*`: rejected due to accessibility drift.
- Responsive conditional layouts: rejected; requirement applies across breakpoints.

### Validation
- Visual: Status appears above Content with compact spacing (`gap-2`).
- A11y: Reading and tab order is Status → Content.
- Non-regression: Other card parts unaffected; no overflow or clipping across breakpoints.

### Risks and Mitigations
- Shared markup pattern elsewhere: Mitigated by scoping change to subtask card template.
- Long content growth: Existing wrapping/truncation retained.

### Rollback
Revert container to `flex items-start justify-between gap-2` and restore original child order if necessary.