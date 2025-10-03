**Release Readiness**

- Change implemented and scoped correctly to subtask cards on Board.
- Evidence: vertical stack present at `frontend/src/app/features/board/page.html:261` with `flex flex-col items-start justify-start gap-2`; Status `span` precedes Title `h4` (`frontend/src/app/features/board/page.html:262`, `frontend/src/app/features/board/page.html:267`).
- No other views or card parts were altered; spacing and typography preserved.

**Acceptance Verification**

- Status appears above Content and in DOM order (Status → Title).
- `justify-between` removed; `gap-2` retained for compact spacing.
- DnD attributes and labels/metadata unchanged (`frontend/src/app/features/board/page.html:249`, `frontend/src/app/features/board/page.html:277`).
- Works across breakpoints (no responsive overrides in this container).

**CI/Quality Gates**

- Frontend:
  - `cd frontend && npm test -- --watch=false`
  - `npm run lint && npm run format:check`
  - `npm run build`
- Backend (unchanged but keep green):
  - `pytest backend/tests`
  - `ruff check backend`
  - `black --check backend/app backend/tests`
- Optional: attach Board before/after screenshots in PR for visual confirmation.

**Risks**

- Low. The change is a localized template tweak; potential selector brittleness only if tests relied on sibling order within this container.

**Rollback Plan**

- Revert the container block at `frontend/src/app/features/board/page.html:261–270` to the previous class `flex items-start justify-between gap-2` and original child order (Title above Status).
- Safe to revert without backend or data implications.

**Go/No-Go**

- Go, contingent on CI passing. The implemented layout matches requirements and acceptance criteria with minimal impact.