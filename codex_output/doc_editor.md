**Scope**

- Edit wording for consistency, terminology, and formatting across README note, CHANGELOG entry, and ADR draft.
- Keep language English, concise, and aligned with repo conventions.

**Preferred Terms**

- Board view (not “Board screen”)
- Subtask card (not “subtask tile/card UI”)
- Status (the subtask’s status shown via the column name)
- Content (the subtask title/description block)
- Vertical stack; stack Status above Content
- Tailwind utility classes (e.g., `flex`, `flex-col`, `gap-2`)

**Formatting Rules**

- Wrap class names and file paths in backticks.
- Capitalize component/view names (“Board view”, “Status”, “Content”).
- Use imperative voice: “Stack”, “Update”, “Verify”.
- Keep bullet points parallel and single‑line where possible.
- Use “all breakpoints” rather than “universally” or “across devices”.

**Terminology Alignment**

- Refer to the status text as “Status” even when bound to `{{ column.title }}` (clarify once: “Status (column title)”).
- Use “stack Status above Content” consistently (avoid mixing “status on top”/“status first”).

**Copyedits (Ready‑to‑Use)**

- README (Frontend UI → Board view → Subtasks)
  - Goal: Stack Status above Content in subtask cards.
  - Layout: The container uses `flex flex-col items-start justify-start gap-2`.
  - Order: Status (column title) precedes Content (subtask title) in the DOM.
  - File: `frontend/src/app/features/board/page.html:261`
  - Rationale: Improves readability and aligns visual and tab/reading order.
  - Verify: Confirm the container excludes `justify-between` and includes `flex-col` with `gap-2`.

- CHANGELOG
  - Changed: Board subtask cards now stack Status above Content using a vertical layout.
    - Replaced `flex items-start justify-between gap-2` with `flex flex-col items-start justify-start gap-2`.
    - DOM order updated to Status (column title) before Content (subtask title).
    - Scope: Board view only. No behavioral changes.

- ADR
  - Title: Stack Status Above Content in Board Subtask Cards
  - Context: Subtask cards used a horizontal row (`flex items-start justify-between gap-2`).
  - Decision: Use `flex flex-col items-start justify-start gap-2` and place Status (column title) before Content (subtask title) in the DOM. Scope limited to Board subtask cards.
  - Consequences: Improved readability and accessibility; no behavior changes.
  - Rollback: Restore previous class string and child order.

**Acceptance Criteria Wording (Consistent)**

- The container uses `flex flex-col items-start justify-start gap-2` at all breakpoints.
- Status (column title) appears above Content (subtask title) and precedes it in the DOM.
- `justify-between` is not used; spacing is provided by `gap-2`.
- No visual/behavioral regressions outside subtask cards on the Board view.

**Notes**

- If mentioning `justify-start`, state it explicitly once; it’s redundant with `flex-col` but acceptable for clarity.
- When referencing Japanese examples, mark them as examples and keep surrounding documentation in English.