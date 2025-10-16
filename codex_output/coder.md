**Summary**
- Implemented two small, behavior-preserving refactors to improve readability and consistency with minimal diff.

**Changes Made**
- Backend
  - `backend/app/sqlalchemy_py313_compat.py:22`:
    - Merged adjacent f-strings into a single f-string:
      - From: `f"... has " f"additional attributes {remaining}."`
      - To: `f"... has additional attributes {remaining}."`
- Frontend
  - `frontend/src/app/lib/forms/signal-forms.ts:22`:
    - Simplified signal update:
      - From: `store.update((current) => updater(current));`
      - To: `store.update(updater);`

**Why**
- Reduces noise and improves readability without changing behavior.
- Aligns with small, safe, and targeted refactoring goals.

**Verification Commands**
- Backend tests (if deps available): `cd backend && pytest -q`
- Frontend unit tests (if deps available): `cd frontend && npm test -- --watch=false`
- Optional SPA build: `cd frontend && npm run build`

**Residual Risks / Open Questions**
- No functional risk expected; both changes are mechanical.
- Do you want a follow-up pass for docstrings/comments or similar micro-refactors in specific modules?