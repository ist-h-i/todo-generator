# Repository Guidelines

## Project Structure & Module Organization
- `backend/app` hosts FastAPI routers, services, models, and migrations, with `backend/tests` mirroring modules and fixtures under `backend/tests/utils`.
- `frontend/src/app` splits shared infrastructure in `core`, `shared`, and `lib` from features under `features/*`; keep specs beside components.
- `docs/` carries architecture and workflow rules, while `scripts/` holds automation such as `run_codex_pipeline.sh`.

## Build, Test, and Development Commands
- `start-localhost.bat` seeds the virtualenv, installs npm packages, and launches the backend and Angular dev servers on Windows.
- Backend flow: `pip install -r backend/requirements.txt` (plus `requirements-dev.txt` for tooling) and `uvicorn app.main:app --reload --app-dir backend`.
- Quality checks: `pytest backend/tests`, `ruff check backend`, `black --check backend/app backend/tests`, then `cd frontend && npm install`, `npm start`, `npm test -- --watch=false`, `npm run lint`, `npm run format:check`, `npm run build`.

## Coding Style & Naming Conventions
- `.editorconfig` enforces UTF-8, two-space indentation, trimmed whitespace, and final newlines across languages.
- Python uses Black (120 columns) and Ruff's double-quote rules; keep packages snake_case and Pydantic models in PascalCase.
- Angular code relies on ESLint + Prettier with single quotes; favor kebab-case folders, keep selectors descriptive, and co-locate component assets.

## Testing Guidelines
- Place backend coverage in `backend/tests/test_*.py`; reuse fixtures from `conftest.py` and guard new branches before merging.
- Angular specs stay beside sources as `*.spec.ts`; disable watch mode in CI with `npm test -- --watch=false`.
- Run lint and format checks alongside tests on logic changes; documentation-only edits may skip them per `docs/development-rules.md`.

## Commit & Pull Request Guidelines
- Write imperative, capitalized subjects (~65 chars) to match the existing `git log`, and squash noisy fixups.
- Sync with `main`, rerun the relevant checks, and call out migrations or configuration updates in the PR body.
- PRs should link issues, summarize behavior, and include screenshots for UI tweaks plus any manual verification notes.

## Security & Configuration Tips
- Preserve ownership scoping in `backend/app/routers/reports.py` and similar endpoints to prevent cross-admin escalation.
- Store secrets through the admin console with a strong `SECRET_ENCRYPTION_KEY`, and override `DATABASE_URL` outside the default SQLite sandbox.
- Align CORS settings with the deployed SPA and avoid verbose logging of sensitive payloads when `DEBUG` is enabled.
