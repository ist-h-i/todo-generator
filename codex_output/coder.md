I’m updating the board subtask header layout by switching the flex row to a column and moving status above content.

**Changed Files**
- frontend/src/app/features/board/page.html:261

**Replacement Block**
- In `frontend/src/app/features/board/page.html:261`, replace the container and swap child order to stack status above content:

Old
```
<div class="flex items-start justify-between gap-2">
  <h4 class="min-w-0 break-words text-sm font-semibold text-on-surface">
    {{ subtask.title }}
  </h4>
  <span
    class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
  >
    {{ column.title }}
  </span>
</div>
```

New
```
<div class="flex flex-col items-start gap-2">
  <span
    class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
  >
    {{ column.title }}
  </span>
  <h4 class="min-w-0 break-words text-sm font-semibold text-on-surface">
    {{ subtask.title }}
  </h4>
</div>
```

**What Changed and Why**
- `flex → flex flex-col`: vertical stacking at all breakpoints.
- Removed `justify-between`: not applicable for column direction.
- Reordered DOM: status (`{{ column.title }}`) before content (`{{ subtask.title }}`) to keep visual and screen-reader order aligned.
- Preserved `items-start` and `gap-2` for left alignment and spacing.

**Run Commands (local verification)**
- Backend/format checks (safe if you already have env): 
  - `pytest backend/tests`
  - `ruff check backend`
  - `black --check backend/app backend/tests`
- Frontend (requires deps; skip if network-restricted):
  - `cd frontend && npm install`
  - `npm start`
  - `npm test -- --watch=false`
  - `npm run lint`
  - `npm run format:check`
  - `npm run build`

This is a minimal, scoped change affecting only the subtask card header on the board view, meeting the requirement: status on top, content below, consistent spacing, and preserved alignment.