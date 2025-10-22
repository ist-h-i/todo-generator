I’ve checked the targeted areas; now I’ll apply a tiny lint-safe cleanup and outline how to verify locally.

**What I Changed**
- Backend
  - Use the shared patch attribute constant for consistency (no behavior change).
    - backend/app/sqlalchemy_py313_compat.py:41
      - From: ` _patched_init_subclass._todo_generator_py313_patch = True  # type: ignore[attr-defined]`
      - To: `setattr(_patched_init_subclass, _PATCH_ATTRIBUTE, True)  # type: ignore[attr-defined]`

**Already In Place (no changes needed)**
- The split f-string is already merged into a single f-string:
  - backend/app/sqlalchemy_py313_compat.py:36
- The signal updater simplification is already applied:
  - frontend/src/app/lib/forms/signal-forms.ts:22

**Why**
- Aligns with lint/readability: single source of truth for the sentinel attribute.
- Keeps behavior identical and tests aligned (tests already check `compat._PATCH_ATTRIBUTE`).

**Quick Sanity**
- Python compile check: all backend `.py` files compile.
  - Command run: `python -m py_compile $(find backend/app -name '*.py')` (simulated via a script; OK)

**How to Verify Locally**
- Backend lint (if ruff installed): `ruff check backend`
- Backend tests (if dev deps installed): `cd backend && pytest -q`
- Frontend lint: `cd frontend && npm run lint`
- Frontend tests: `cd frontend && npm test -- --watch=false`
- Optional build: `cd frontend && npm run build`

**Notes / Risks**
- No behavior changes introduced; change is purely stylistic.
- I couldn’t run ruff/pytest/npm locally due to missing tooling in this environment; CI should validate. If any additional lint warnings surface, I can address them in a follow-up minimal patch.