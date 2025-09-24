# Todo Generator

Todo Generator is a full-stack productivity workspace that pairs an Angular 20 single-page
application with a FastAPI backend and ChatGPT-powered automation to turn free-form notes into
structured work, analytics artefacts, and coaching workflows.【F:frontend/src/app/app.routes.ts†L9-L66】【F:backend/app/main.py†L1-L69】【F:backend/app/services/chatgpt.py†L43-L190】【F:backend/app/models.py†L120-L439】

## Feature Highlights
- **AI-assisted intake & reporting** – The `/analysis` endpoint enriches user context and invokes the
  ChatGPT client to transform notes into validated proposals, while the daily report service reuses the
  integration to summarise shifts and draft follow-up cards automatically.【F:backend/app/routers/analysis.py†L1-L27】【F:backend/app/services/chatgpt.py†L43-L190】【F:backend/app/services/daily_reports.py†L23-L199】
- **Workspace task management** – Cards capture priorities, statuses, labels, initiatives, and nested
  subtasks in the database, and the Angular board groups, filters, and drags tasks with quick filters
  and subtask rollups for collaboration.【F:backend/app/models.py†L120-L167】【F:frontend/src/app/features/board/page.ts†L1-L199】
- **Analytics & improvement loops** – Admin routes manage analytics snapshots, root-cause analyses,
  and suggested actions that tie back to cards and initiatives so continuous-improvement work stays
  measurable.【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/models.py†L301-L439】
- **Competency development & evaluations** – Competency APIs let administrators curate rubrics,
  enforce daily evaluation quotas, and trigger assessments that feed profile insights in the frontend
  workspace.【F:backend/app/routers/competencies.py†L1-L120】【F:frontend/src/app/app.routes.ts†L33-L46】
- **Admin & security controls** – Encrypted API credential storage, quota overrides, and session token
  management keep AI keys and automation limits under administrative control while the frontend guards
  protect privileged routes.【F:backend/app/routers/admin_settings.py†L1-L140】【F:backend/app/auth.py†L1-L123】【F:frontend/src/app/core/auth/admin.guard.ts†L1-L23】

## Technology Stack
- **Frontend** – Angular 20 with CDK drag-and-drop, reactive forms, and lazy-loaded feature modules.
  Scripts for development, testing, linting, and formatting live in `package.json`.【F:frontend/package.json†L1-L60】【F:frontend/src/app/app.routes.ts†L9-L66】
- **Backend** – FastAPI application that wires routers for analysis, cards, analytics, initiatives,
  reporting, auth, and admin operations at startup.【F:backend/app/main.py†L1-L69】
- **Persistence** – SQLAlchemy models map users, cards, subtasks, analytics artefacts, daily reports,
  suggested actions, competencies, and quotas to a relational database (SQLite by default).【F:backend/app/models.py†L120-L439】【F:backend/app/config.py†L10-L33】
- **AI services** – A typed ChatGPT client wraps the Responses API with schema validation so
  automation returns predictable proposals for intake and reporting flows.【F:backend/app/services/chatgpt.py†L43-L190】

## Repository Layout
```
.
├── backend/                # FastAPI service, SQLAlchemy models, and pytest suite
├── frontend/               # Angular 20 single-page application
├── docs/                   # Architecture, development rules, and product requirements
├── scripts/                # Automation helpers (auto-resolve workflow)
└── start-localhost.bat     # Windows convenience script to boot backend + frontend
```
Key documentation lives under `docs/`, including system architecture, development rules, and extended
feature requirements.

## Getting Started
### Prerequisites
- Python 3.11+ for the backend toolchain and lint configuration.【F:pyproject.toml†L1-L28】
- Node.js and npm to run the Angular CLI scripts defined in the frontend project.【F:frontend/package.json†L1-L60】
- An OpenAI API key to enable ChatGPT-powered analysis; configure it through the admin settings so the
  backend ChatGPT client can decrypt and call the Responses API.【F:backend/app/services/chatgpt.py†L111-L157】【F:backend/app/routers/admin_settings.py†L22-L81】

### One-click startup on Windows
Run the bundled script from the repository root to provision a virtual environment, install
dependencies, and launch both services:
```
start-localhost.bat
```
The script boots the FastAPI backend at <http://localhost:8000> and the Angular frontend at
<http://localhost:4200>.【F:start-localhost.bat†L1-L41】

### Manual startup (macOS/Linux)
1. **Backend**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   # Optional: linting/formatting helpers
   pip install -r backend/requirements-dev.txt
   uvicorn app.main:app --app-dir backend --reload
   ```
   Install dependencies from `backend/requirements.txt` and run the FastAPI app with reload enabled
   during development.【F:backend/requirements.txt†L1-L13】【F:backend/app/main.py†L1-L69】

2. **Frontend** (in a separate terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   The Angular dev server runs on port 4200 with hot module replacement via `npm start`.【F:frontend/package.json†L4-L12】

### Environment variables
The backend uses Pydantic settings to read configuration from the environment. Common overrides
include the database URL, debug mode, allowed origins, and ChatGPT defaults.【F:backend/app/config.py†L10-L39】
- `DATABASE_URL` – SQLAlchemy connection string (default `sqlite:///./todo.db`).
- `DEBUG` – Enable FastAPI debug mode (default `false`).
- `CHATGPT_MODEL` – Logical model name surfaced by the analysis and reporting services.
- `ALLOWED_ORIGINS` – Comma-separated list of allowed CORS origins.
- `SECRET_ENCRYPTION_KEY` – Optional key used to encrypt stored API credentials.

## Running Tests & Quality Checks
Run automated checks before sending a pull request:
```bash
# Backend API tests and linting
pytest backend/tests
ruff check backend
black --check backend/app backend/tests

# Frontend unit tests (Karma) and formatting
cd frontend
npm test
npm run lint
npm run format:check
```
Backend dependencies include pytest, while linting/formatting rules are configured via Ruff and
Black. Frontend scripts rely on the npm commands declared in `package.json`.【F:backend/requirements.txt†L1-L13】【F:pyproject.toml†L1-L28】【F:frontend/package.json†L4-L12】

## Documentation & Architecture
- `docs/architecture.md` – System context, component responsibilities, interaction diagram, and key
  flows across frontend, backend, and AI services.【F:docs/architecture.md†L1-L76】
- `docs/development-rules.md` – Detailed engineering workflow expectations and required quality
  checks.【F:docs/development-rules.md†L1-L35】
- `docs/feature-expansion-requirements.md` – Product vision and analytics/reporting requirements for
  upcoming roadmap work.【F:docs/feature-expansion-requirements.md†L1-L40】
