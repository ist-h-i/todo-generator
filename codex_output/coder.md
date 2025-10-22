I’ve checked targeted areas; now confirming minimal, lint-safe fixes are in place.

**Summary**
- Aligned backend compat patch marker and simplified a frontend signal update as no-op refactors to satisfy lint without behavior change.
- Couldn’t run linters/tests locally due to missing tools/deps; changes are surgical and match configured rules.

**What I Touched**
- Backend
  - Use the shared patch attribute sentinel via `setattr(...)` for consistency.
    - backend/app/sqlalchemy_py313_compat.py:41
  - Confirmed adjacent f-strings are merged.
    - backend/app/sqlalchemy_py313_compat.py:36
- Frontend
  - Confirmed direct updater form for signals is used.
    - frontend/src/app/lib/forms/signal-forms.ts:32

**Current State (quick sanity)**
- Python compiles cleanly across backend sources.
  - backend/app (all .py) compiled
- ESLint config allows `any` only in the select component; implementation adheres.
  - frontend/.eslintrc.cjs:1
  - frontend/src/app/shared/ui/select/ui-select.ts:223

**How To Verify**
- Backend
  - Lint: `ruff check backend` (CI environment)  
  - Tests: `cd backend && pytest -q`
- Frontend
  - Lint: `cd frontend && npm run lint`
  - Tests: `cd frontend && npm test -- --watch=false`
  - Build: `cd frontend && npm run build`

**File References**
- backend/app/sqlalchemy_py313_compat.py:36
- backend/app/sqlalchemy_py313_compat.py:41
- frontend/src/app/lib/forms/signal-forms.ts:32
- frontend/.eslintrc.cjs:1
- frontend/src/app/shared/ui/select/ui-select.ts:223

**Residual Risks / Open Questions**
- Tools not available here (ruff/pytest/npm), so I couldn’t execute linters/tests locally; CI should validate.
- If CI flags additional, unrelated lint violations, I can apply minimal, localized fixes without expanding scope.
- Angular Signals API versions can differ; `store.update(updater)` is idiomatic on v16+ and should be compatible with v20 used here.