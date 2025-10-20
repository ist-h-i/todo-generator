# Repository Index & Map

This page helps newcomers quickly find the right code and docs. It complements the [Documentation Index](README.md) by focusing on repository layout and key entry points.

## Quick Pointers

- Setup, scripts, and common tasks: [README.md](../README.md)
- Specs and playbooks: [Documentation Index](README.md)
- UI standards and layout: [UI Design System](ui-design-system.md), [UI Layout Requirements](ui-layout-requirements.md)
- Governance and quality bars: [Development Governance Handbook](governance/development-governance-handbook.md)
- Angular coding rules: [Angular Coding & Design Guidelines](guidelines/angular-coding-guidelines.md)

## Top-level Layout

- `frontend/` — Angular SPA (standalone components, signals, feature routing)
  - `src/app/app.routes.ts` — Route map and feature entry points.
  - `src/app/features/` — Feature areas (e.g., `board/`, `reports/`, `analytics/`, `admin/`).
  - `src/app/core/` — Cross-cutting concerns and APIs:
    - `core/api/*.service.ts` — HTTP clients (e.g., `CardsApiService`, `AdminApiService`).
    - `core/state/*store.ts` — Signal stores (e.g., `WorkspaceStore`).
    - `auth/`, `profile/`, `logger/`, `models/`, `utils/` — Auth, profile, logging, types, and helpers.
  - `src/app/shared/` — Reusable UI primitives and utilities.

- `backend/` — FastAPI backend (routers, services, schemas, tests)
  - `app/main.py` — Application entrypoint and middleware.
  - `app/routers/` — API surface by domain (e.g., `cards.py`, `reports.py`, `analytics.py`).
  - `app/services/` — Domain logic, Gemini integrations, content builders.
  - `app/schemas.py`, `app/models.py` — Pydantic schemas and ORM models.
  - `tests/` — Pytest suites mirroring the routers/services.

- `docs/` — Architecture notes, feature requirements, and playbooks
  - Start at docs/README.md for a curated, topic-based index.
  - Deep dives: `architecture.md`, `data-flow-overview.md`, `persistence-detail-design.md`.

- `scripts/` — Local ops and automation helpers
  - `run_codex_pipeline.sh` — Auto‑dev pipeline runner.
  - `generate_*_recipes.py` — Creates code recipe docs co-located next to source files (`*.recipe.md`).
  - `bootstrap_database.py` — Initialize local DB state.

- `prompts/` — Prompt materials used by services and tooling.

- `.github/workflows/` — CI pipelines (lint, tests, secret scans, SonarQube).

- `workflow/` — Internal workflow documentation for contributors.

- `codex_output/` — Automation artifacts (planning, reviews, release notes). Safe to keep in-repo.

## Common Tasks → Where to Look

- Add a new page (SPA)
  - Define route in `frontend/src/app/app.routes.ts` and add a feature under `frontend/src/app/features/<feature>/`.
  - Follow Angular rules in `docs/guidelines/angular-coding-guidelines.md` and UI conventions in `docs/ui-design-system.md`.

- Call a backend API from the SPA
  - Add/extend an API client in `frontend/src/app/core/api/*.service.ts`.
  - Manage state in a store under `frontend/src/app/core/state/*store.ts`.

- Add a new API endpoint (FastAPI)
  - Create a router in `backend/app/routers/<domain>.py`, plug it into `app/main.py` if needed.
  - Implement logic in `backend/app/services/`, define request/response in `backend/app/schemas.py`.
  - Add tests in `backend/tests/` mirroring the new router.

- Update data contracts and models
  - Adjust Pydantic schemas in `backend/app/schemas.py` and clients/types in `frontend/src/app/core/models/`.

## Search Tips (ripgrep)

- Routes (Angular): `rg -n "export const .*Routes|appRoutes|Routes\s*=\s*\[" frontend/src/app`
- Components: `rg -n "@Component\(" frontend/src/app`
- Stores: `rg -n "class .*Store" frontend/src/app/core/state`
- API clients: `rg -n "export class .*ApiService" frontend/src/app/core/api`
- FastAPI routers: `rg -n "APIRouter\(|router = APIRouter" backend/app/routers`
- Service functions: `rg -n "def .*\(" backend/app/services`

## Configuration & Quality

- Python tooling: `pyproject.toml`, `backend/requirements*.txt`
- Frontend tooling: `frontend/package.json`, `frontend/angular.json`, `frontend/tailwind.config.js`
- SonarQube: `sonar-project.properties` (coverage paths and quality gate inputs)
- CI: `.github/workflows/*.yml`

## See Also

- [Documentation Index](README.md)
- [UI Design System](ui-design-system.md)
- [UI Layout Requirements](ui-layout-requirements.md)
- [Development Governance Handbook](governance/development-governance-handbook.md)
- [Angular Coding & Design Guidelines](guidelines/angular-coding-guidelines.md)
