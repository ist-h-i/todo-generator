**Summary**
- The subtask card layout change is already implemented; no additional code changes required.

**Verification**
- Container uses vertical stack: `frontend/src/app/features/board/page.html:261` shows `div.flex.flex-col.items-start.gap-2`.
- Status appears above content:
  - Status label node: `frontend/src/app/features/board/page.html:265`.
  - Title/content node: `frontend/src/app/features/board/page.html:267`.
- Horizontal layout class not present elsewhere in app templates.

**Acceptance Criteria**
- Status above content at all breakpoints: satisfied.
- Left alignment and spacing preserved: `items-start`, `gap-2`: satisfied.
- DOM order matches visual order (a11y): satisfied.
- Change scoped to subtask cards only: satisfied.

**Impact**
- No other board or global layouts affected.
- Card height may increase slightly as expected; DnD container remains intact.

**CI/Readiness**
- No new files or dependencies. Frontend builds/tests should pass unchanged.
- Recommend running: `cd frontend && npm run lint && npm test -- --watch=false && npm run build` when CI is available.

**Follow-ups (Optional)**
- Check contrast/legibility of status text (`text-slate-500` at 11px) against background.
- If supporting older Safari, confirm flex `gap` behavior on this view.