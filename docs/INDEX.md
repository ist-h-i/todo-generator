# Repository Index & Map

Use this map when you need to find code fast. For a full catalogue of written guidance, switch to the [Documentation Index](README.md).

## Quick Pointers

- Project setup and local workflows: [../README.md](../README.md)
- SPA bootstrap and routes: `frontend/src/app/app.routes.ts`
- FastAPI entry point and middleware: `backend/app/main.py`
- Quality automation: `.github/workflows/` and `scripts/`
- Documentation catalogue: [Documentation Index](README.md)

## Top-level Layout

- `frontend/` — Angular SPA (standalone components, signals, feature routing)
  - `src/app/app.routes.ts` — route map and lazy-loaded feature entry points
  - `src/app/features/` — feature areas such as `board/`, `reports/`, `analytics/`, `admin/`
  - `src/app/core/` — cross-cutting concerns
    - `core/api/*.service.ts` — HTTP clients (e.g., `CardsApiService`, `AdminApiService`)
    - `core/state/*store.ts` — signal stores (e.g., `WorkspaceStore`)
    - `auth/`, `profile/`, `logger/`, `models/`, `utils/` — authentication, identity, logging, shared types, helpers
  - `src/app/shared/` — reusable UI primitives and utilities

- `backend/` — FastAPI backend (routers, services, schemas, tests)
  - `app/main.py` — application bootstrap and middleware
  - `app/routers/` — API surface by domain (`cards.py`, `reports.py`, `analytics.py`, etc.)
  - `app/services/` — domain logic, Gemini integrations, content builders
  - `app/schemas.py`, `app/models.py` — Pydantic schemas and ORM models
  - `tests/` — pytest suites mirroring routers and services

- `docs/` — architecture notes, governance rules, feature requirements; start at `docs/README.md`
- `scripts/` — local automation helpers (`run_codex_pipeline.sh`, `bootstrap_database.py`, `generate_*_recipes.py`)
- `prompts/` — prompt assets used by backend services and tooling
- `.github/workflows/` — CI definitions for lint, tests, scans, and quality gates
- `workflow/` — internal contributor workflow guidance
- `codex_output/` — automation artefacts (planning logs, reviews, release notes)

## Frontend Hotspots

- Complex component guides: `frontend/src/app/**/**/*.recipe.md`
- Styling tokens and theming: `frontend/src/styles/` plus feature SCSS
- Shared UI primitives: `frontend/src/app/shared/ui/`
- Build configuration: `frontend/angular.json`, `frontend/tailwind.config.js`

## Backend Hotspots

- Router registration: `backend/app/main.py`
- Domain services and integrations: `backend/app/services/`
- Utilities for quotas, encryption, scheduling: `backend/app/utils/`
- Database bootstrap and migrations: `backend/app/models.py`, `backend/migrations/`

## Common Tasks — Where to Start

- **Add a new SPA page**
  - Register the route in `frontend/src/app/app.routes.ts`
  - Create the feature module under `frontend/src/app/features/<feature>/`
  - Wire API calls via `frontend/src/app/core/api` and state via `core/state`

- **Call a backend API from the SPA**
  - Extend or add a client in `frontend/src/app/core/api/*.service.ts`
  - Mirror contracts in `frontend/src/app/core/models/`

- **Add a FastAPI endpoint**
  - Create a router in `backend/app/routers/<domain>.py` and mount it from `app/main.py`
  - Implement business logic inside `backend/app/services/`
  - Update schemas in `backend/app/schemas.py` and test via `backend/tests/`

- **Adjust data contracts**
  - Source of truth: `backend/app/schemas.py` and `backend/app/models.py`
  - Frontend mirror: `frontend/src/app/core/models/` and mapper helpers in `core/api`

## Search Tips (ripgrep)

- Routes (Angular): `rg -n "export const .*Routes|appRoutes|Routes\\s*=\\s*\\[" frontend/src/app`
- Components: `rg -n "@Component\\(" frontend/src/app`
- Stores: `rg -n "class .*Store" frontend/src/app/core/state`
- API clients: `rg -n "export class .*ApiService" frontend/src/app/core/api`
- FastAPI routers: `rg -n "APIRouter\\(|router = APIRouter" backend/app/routers`
- Service functions: `rg -n "def .*\\(" backend/app/services`

## Configuration & Quality Files

- Python tooling: `pyproject.toml`, `backend/requirements*.txt`
- Frontend tooling: `frontend/package.json`, `frontend/angular.json`, `frontend/tailwind.config.js`
- Quality gates: `.github/workflows/*.yml`, `sonar-project.properties`

## See Also

- [Documentation Index](README.md) — curated guide to architecture, governance, and feature docs
- [Development Governance Handbook](governance/development-governance-handbook.md) — coding standards and quality gates
- [Angular Coding & Design Guidelines](guidelines/angular-coding-guidelines.md) — SPA-specific rules
