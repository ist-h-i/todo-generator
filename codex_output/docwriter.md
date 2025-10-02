**Changelog**

- Board: Subtask card layout updated to stack “status” above “content” at all breakpoints.
  - Alignment and spacing preserved (`items-start`, `gap-2`); removed `justify-between`.
  - DOM order now status → content for accessibility.
  - No data or behavior changes; UI-only.
  - File: frontend/src/app/features/board/page.html:261

**ADR: Board Subtask Card Layout**

- Status: Accepted
- Context
  - Subtask cards previously placed “status” and “content” side-by-side using `flex items-start justify-between gap-2`.
  - Requirement: stack vertically with status on top, content below, across all breakpoints.
- Decision
  - Use `flex flex-col items-start gap-2` and remove `justify-between`.
  - Ensure DOM order is status before content to match visual and screen-reader order.
  - Scope limited to the board subtask card container.
- Consequences
  - Slight height increase for cards; left alignment and spacing remain consistent.
  - Improved accessibility (meaningful sequence).
  - No global/shared component impact detected.
- Implementation Reference
  - frontend/src/app/features/board/page.html:261

**README Note (Frontend UI)**

- Board subtask cards display the status above the content/title with vertical spacing.
  - Visual and DOM order aligned; left-aligned, consistent spacing.
  - Template reference: frontend/src/app/features/board/page.html:261

**Verification Summary**

- Container uses `flex flex-col items-start gap-2`; `justify-between` removed.
- Status (`{{ column.title }}`) precedes content (`{{ subtask.title }}`) in DOM.
- No other occurrences of the old class found in the frontend.