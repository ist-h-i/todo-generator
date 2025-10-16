**Scope & Strategy**
- Keep refactor non-functional and ultra-targeted to readability.
- Touch only two files with safe, mechanical improvements.
- Avoid dependency changes, build config edits, or broad renames.

**Proposed Changes**
- Backend string formatting cleanup for clarity.
  - `backend/app/sqlalchemy_py313_compat.py:36`: Merge adjacent f-strings into one for readability without behavior change.
- Frontend signal utility simplification.
  - `frontend/src/app/lib/forms/signal-forms.ts:32`: Replace `store.update((current) => updater(current));` with `store.update(updater);` for equivalent behavior with simpler expression.

**Why This Set**
- Achieves “periodic refactoring” with the smallest viable diff.
- Improves clarity/maintainability without altering logic or interfaces.
- Fits comfortably within a single <30-minute execution window.

**Residual Risks / Open Questions**
- Risk: None expected; both changes are no-op behaviorally.
- Open questions:
  - Do you want broader readability passes (docstrings, comments) in select modules next?
  - Any priority areas (e.g., routers, services, Angular guards) to focus future micro-refactors?

**Test/Verification Guidance**
- Backend (if deps installed): `cd backend && pytest -q`
- Frontend (if deps installed): `cd frontend && npm test -- --watch=false`
- Sanity build: `cd frontend && npm run build`

```json
{"steps":["coder"],"notes":"Make two safe, readability-only refactors: merge a split f-string in backend/sqlalchemy_py313_compat.py and simplify a signals update call in frontend/lib/forms/signal-forms.ts. No behavior change, minimal diff, no new dependencies.","tests":"If dependencies are available: run backend pytest and frontend unit tests. Otherwise defer to CI. Commands: (1) cd backend && pytest -q (2) cd frontend && npm test -- --watch=false (3) optional: cd frontend && npm run build"}
```