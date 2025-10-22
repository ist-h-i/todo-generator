**Plan Summary**
- Keep changes minimal and behavior-preserving; focus on fixing lint and ensuring tests pass.
- Apply small, mechanical refactors in pinpointed spots only; avoid deps/config changes.

**Targeted Fixes**
- Backend: merge adjacent f-strings for readability (no-op behavior).
- Frontend: simplify signal state update by passing the updater directly (equivalent behavior).

**Why This Route**
- Smallest viable diff to address common lint/style issues without risking behavior.
- Fits comfortably in ≤30 minutes; avoids scope creep.

**Risks**
- Unknown exact linters; coder must align to repo’s configured tools (ruff/flake8, ESLint).
- If other unrelated lint failures exist, follow-up might be needed; keep changes scoped.

**Validation**
- Run backend and frontend tests; run linters using repo scripts if available.
- No build or API changes; expect all tests to pass after fixes.

```json
{
  "steps": ["coder"],
  "notes": "Implement minimal, behavior-preserving lint fixes: (1) merge split f-string in backend/app/sqlalchemy_py313_compat.py; (2) simplify signal update in frontend/src/app/lib/forms/signal-forms.ts by passing updater directly. Use repo lint scripts if present, avoid dependency/config changes, and keep diffs minimal.",
  "tests": "Backend: `cd backend && pytest -q` | Lint (pick what's configured): `cd backend && ruff check .` or `flake8`.\nFrontend: `cd frontend && npm test -- --watch=false` | Lint: `cd frontend && npm run lint`.\nOptional build: `cd frontend && npm run build`."
}
```
