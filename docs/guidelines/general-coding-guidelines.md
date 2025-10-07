# General Coding Guidelines

## Purpose
These guidelines capture the project-wide standards that apply to backend services, shared tooling, documentation, and repository hygiene. They complement the Angular-specific rules described in `angular-coding-guidelines.md`.

## Repository & Project Structure
- `backend/app` contains FastAPI routers, services, models, and migrations; keep mirrors for tests under `backend/tests/**` and shared fixtures in `backend/tests/utils`.
- `frontend/src/app` separates shared infrastructure (`core`, `shared`, `lib`) from feature modules under `features/*`. Specs live beside the implementation files they validate.
- Documentation belongs in `docs/` and is indexed from `docs/README.md`. Automation and helper scripts belong in `scripts/` (for example `run_codex_pipeline.sh`).
- Keep environments isolated per `.venv` / `node_modules`. Do not commit generated artefacts or local environment files beyond `.env.example` style templates.

## Python & Backend Practices
- Prefer typed, synchronous FastAPI routers that delegate business logic to `app/services/**`. Limit routers to request validation, response shaping, and dependency wiring via `Depends`.
- Model persistence with SQLAlchemy in `app/models.py` (or adjacent modules) and expose strict Pydantic schemas under `app/schemas/**`. Use PascalCase for schema classes and snake_case for packages and modules.
- Use repository helpers or service classes to isolate side effects (database writes, external APIs, encryption) so they are unit-test friendly.
- Keep migrations additive and idempotent. Startup migrations run through `run_startup_migrations`, so guard destructive changes with explicit operator instructions.
- Log sensitive events with structured logging but avoid copying secrets or personally identifiable information into logs. Respect `settings.allowed_origins` for CORS and keep default logging levels at INFO.

## Shared Tooling & Formatting
- `.editorconfig` enforces UTF-8, two-space indentation, trimmed trailing whitespace, and terminal newlines.
- Format Python with Black (`black backend/app backend/tests`) and lint with Ruff (`ruff check backend`). Resolve Ruff warnings rather than suppressing them if at all possible.
- Type hints are required for new Python code. Favour `typing.Annotated` for FastAPI parameter constraints and `from __future__ import annotations` to avoid forward reference issues.
- Frontend code is formatted with Prettier via the Angular tooling; lint with ESLint (`npm run lint`) and keep TypeScript strictness intact (`"noImplicitAny": true`).
- Never check in `any` to the Angular app without a narrowly scoped ESLint suppression and matching justification. Prefer domain DTOs in `frontend/src/app/shared/models`.

## Testing & Quality Checks
- Backend: write tests under `backend/tests/test_*.py`, reuse fixtures defined in `backend/tests/conftest.py`, and exercise service-layer behaviour as well as edge-case validation.
- Frontend: keep component or service specs next to the code (`*.spec.ts`). Disable watch mode in CI (`npm test -- --watch=false`) and prefer using Angular Testing Library helpers.
- Run the relevant quality gates before raising a PR: `pytest backend/tests`, `ruff check backend`, `black --check backend/app backend/tests`, `cd frontend && npm run lint`, `npm run format:check`, `npm test -- --watch=false`, and `npm run build`.
- For documentation-only changes you may skip automated checks, but re-read the affected docs for tone and accuracy (`docs/development-rules.md`).
- Capture manual verification steps (screenshots, reproduction scripts) whenever user-facing behaviour changes.

## Git Workflow & Pull Requests
- Write imperative, capitalised commit subjects around 65 characters. Squash fixups before merging.
- Sync with `main` frequently (`git pull origin main`) and resolve conflicts early. Rebase or merge main before requesting review.
- PR descriptions must link the relevant issue, explain behavioural changes, and mention migrations or configuration updates. Include before/after screenshots for UI adjustments and record any manual QA completed.

## Security & Configuration
- Preserve ownership and tenant scoping in critical routers such as `backend/app/routers/reports.py` to prevent cross-admin escalation.
- Manage secrets through the admin console backed by a strong `SECRET_ENCRYPTION_KEY`. Override `DATABASE_URL` outside the SQLite sandbox and never log decrypted secrets.
- Align CORS settings with the deployed SPA origin list. Avoid verbose logging of payloads when `DEBUG` or verbose logging is enabled.
- Audit third-party dependencies periodically with `npm run lint`, `npm audit`, and backend dependency checks. Document security exceptions in `docs/security-review.md`.

## Documentation & Knowledge Sharing
- Keep `README.md`, architecture docs, and feature playbooks up to date when behaviour changes.
- Note intentional deviations from standards in the affected document with rationale and impact. Keep decision records in issues for future onboarding.
- For substantial features, add or update diagrams, workflow descriptions, and acceptance criteria so downstream teams inherit current knowledge.

