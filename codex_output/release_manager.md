**Release Readiness**

- Change is implemented and scoped to the subtask card header.
- Verified vertical stack and DOM order (status above content) in `frontend/src/app/features/board/page.html:261`.
- No global/shared component impact detected.

**What Was Verified**

- Container uses `flex flex-col items-start gap-2`; `justify-between` removed.
  - File: `frontend/src/app/features/board/page.html:261`
- DOM order: status label precedes content/title.
  - Status: `frontend/src/app/features/board/page.html:263`
  - Title: `frontend/src/app/features/board/page.html:267`
- Left alignment and spacing preserved; applied at all breakpoints.
- No other occurrences of the old class found outside planning docs.

**Acceptance Criteria**

- Status above content across viewports: satisfied.
- Consistent spacing (`gap-2`): satisfied.
- Left alignment preserved: satisfied.
- Visual and DOM order aligned (a11y): satisfied.
- Change isolated to subtask card: satisfied.

**Risks**

- Slight increase in card height may affect DnD hit areas; low risk.
- Legacy Safari flex-gap support (if in scope); consider local `mb-2` fallback if needed.
- Badge contrast at 11px (`text-slate-500`) may be borderline; visual check recommended.

**Pre‑Release Checks**

- Frontend: `cd frontend && npm ci && npm run lint && npm test -- --watch=false && npm run build`
- Optional a11y/visual smoke on board route (status reads before content; no layout jank).

**Rollback Plan**

- Revert the single template change in `frontend/src/app/features/board/page.html` (or the merge commit).
- No migrations or config involved; rollback is immediate and low risk.

**Go/No‑Go**

- Go: Ready to release. Change is minimal, localized, and meets acceptance criteria.