**Terminology**

- Use “Board view” (not “board screen”).
- Use “subtask card” for the UI element.
- Use “status label” (avoid mixing “badge”/“label”/“status”).
- Use “subtask title” for the text content (avoid “content/text/details”).
- Use “vertical stack” for the layout (avoid “stacked vertically” variants).
- Use “accessibility (a11y)” on first mention; “a11y” thereafter.

**Formatting Rules**

- Wrap Tailwind utilities and code identifiers in backticks: `flex flex-col items-start gap-2`, `justify-between`.
- Refer to Angular template bindings via interpolation: `{{ subtask.title }}`, `{{ column.title }}`.
- Keep consistent casing for headings: sentence case in prose; code retains exact case.
- Avoid inline commentary inside code blocks; keep comments in prose.

**File/Code References**

- Reference files with clickable paths and optional line numbers:
  - `frontend/src/app/features/board/page.html:261`
- Keep references singular and exact; do not use ranges.

**Consistent Phrasing (Docs/PR)**

- Change summary: “Subtask cards now use a vertical stack: status label above the subtask title.”
- Implementation note: “Replace `flex items-start justify-between gap-2` with `flex flex-col items-start gap-2` and ensure DOM order is status label → subtask title.”
- Acceptance criteria: “Status label appears above the subtask title at all breakpoints; left alignment and `gap-2` spacing preserved.”

**Commit/Changelog Style**

- Commit subject (imperative): “Stack subtask status above title in Board view”
- Changelog entry: “Board: Subtask card layout uses vertical stack (status label above subtask title); removed `justify-between`.”

**Glossary (for this change)**

- Status label: the badge/label showing the subtask’s status or column state.
- Subtask title: the primary text of the subtask.
- Vertical stack: `flex flex-col` with `items-start` and `gap-2`.

**One‑Line Canonical Description**

- “In the Board view, subtask cards display the status label above the subtask title using a vertical stack (`flex flex-col items-start gap-2`).”