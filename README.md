# Verbalize Yourself

Verbalize Yourself is an AI-guided reflection workspace that pairs an Angular 20 frontend with a FastAPI backend. The platform centralizes card capture, analysis, and reporting while using ChatGPT to streamline each reflection cycle.【F:frontend/src/app/app.routes.ts†L1-L73】【F:backend/app/main.py†L1-L69】

## Feature Highlights
- **Workspace task board** – Group cards by label or status, reprioritize them with drag and drop, and rely on quick filters and templates to keep the workflow organized.【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
- **Card collaboration & activity timelines** – Capture inline comments, keep an audit trail of card changes, and surface discussion history alongside board detail drawers so teammates stay aligned.【F:frontend/src/app/features/board/page.html†L484-L543】【F:frontend/src/app/core/state/workspace-store.ts†L750-L879】【F:backend/app/routers/comments.py†L17-L87】【F:backend/app/routers/activity.py†L17-L62】
- **AI-assisted intake & daily reporting** – Convert free-form reflection notes into structured proposals, generate follow-up tasks from report sections, and send daily or weekly updates automatically.【F:backend/app/routers/analysis.py†L1-L27】【F:backend/app/services/chatgpt.py†L43-L190】【F:backend/app/routers/daily_reports.py†L1-L108】【F:frontend/src/app/features/reports/reports-page.component.ts†L1-L157】
- **Analytics & continuous improvement** – Administrators create analytics snapshots, run Why-Why investigations, capture root causes, and track initiatives on dashboards that stay connected to workspace data.【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/models.py†L301-L439】【F:frontend/src/app/features/analytics/page.ts†L1-L112】【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】
- **Appeal narrative generation** – Produce suggested flows and multi-format narratives that blend ChatGPT output with fallback templates so appeal stories remain consistent.【F:backend/app/routers/appeals.py†L1-L27】【F:backend/app/services/appeals.py†L1-L200】【F:backend/app/services/appeal_prompts.py†L1-L180】
- **Governance & competency management** – Encrypt external API credentials, configure evaluation rubrics, and manage quotas to establish operational guardrails.【F:backend/app/routers/admin_settings.py†L1-L140】【F:backend/app/routers/competencies.py†L1-L120】
- **Personalized competency evaluations** – Let members trigger self-assessments, monitor quota usage, and review AI-authored next steps directly from the profile experience.【F:frontend/src/app/features/profile/evaluations/page.ts†L1-L160】【F:backend/app/routers/competency_evaluations.py†L61-L185】

## Technology Stack
- **Frontend** – Angular 20 standalone components with CDK Drag & Drop, signal-based state management, and ESLint/Prettier tooling.【F:frontend/package.json†L1-L60】【F:frontend/src/app/features/board/page.ts†L1-L160】
- **Backend** – FastAPI and SQLAlchemy expose REST routers and schemas, and a ChatGPT client wraps the Responses API with JSON schema validation.【F:backend/app/main.py†L1-L69】【F:backend/app/schemas.py†L1-L1080】【F:backend/app/services/chatgpt.py†L43-L190】
- **Persistence & background models** – Cards, analytics, Why-Why analyses, suggested actions, daily reports, and appeal content are stored in relational models with JSON columns.【F:backend/app/models.py†L120-L780】

## Repository Layout
```
.
├── backend/                # FastAPI application and ChatGPT integration services
├── frontend/               # Angular 20 single-page application
├── docs/                   # Architecture, development rules, and feature specifications
├── scripts/                # Automation scripts
└── start-localhost.bat     # Windows bootstrap script
```
The primary documentation lives under `docs/`, with feature requirements and detailed designs in `docs/features/`.

## Getting Started
### Prerequisites
- Python 3.11 or later (used with FastAPI, Ruff, and Black).【F:pyproject.toml†L1-L28】
- Node.js / npm (for the Angular CLI and build/test scripts).【F:frontend/package.json†L1-L60】
- OpenAI API key (save it from the admin UI so the ChatGPT client can decrypt and use it).【F:backend/app/services/chatgpt.py†L111-L157】【F:backend/app/routers/admin_settings.py†L22-L81】

### One-click startup on Windows
Run the bundled script from the repository root to create a virtual environment, install dependencies, and start both the backend and frontend:
```
start-localhost.bat
```
The script launches FastAPI at <http://localhost:8000> and the Angular dev server at <http://localhost:4200>.【F:start-localhost.bat†L1-L41】

### Manual startup (macOS/Linux)
1. **Backend**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   # Optional: lint/format toolchain
   pip install -r backend/requirements-dev.txt
   uvicorn app.main:app --app-dir backend --reload
   ```
   Install the dependencies and run the FastAPI app with hot reload enabled.【F:backend/requirements.txt†L1-L13】【F:backend/app/main.py†L1-L69】

2. **Frontend** (run in a separate terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   `npm start` launches the Angular dev server on port 4200.【F:frontend/package.json†L4-L12】

### Environment variables
The backend loads environment variables with Pydantic Settings (database connections, CORS, ChatGPT defaults, encryption keys, and more).【F:backend/app/config.py†L10-L39】

## Running Tests & Quality Checks
Execute the automated checks before opening a pull request.
```bash
# Backend
pytest backend/tests
ruff check backend
black --check backend/app backend/tests

# Frontend
cd frontend
npm test -- --watch=false
npm run lint
npm run format:check
```
`npm test` relies on the Angular CLI (Karma), and ESLint plus Prettier enforce consistent formatting.【F:frontend/package.json†L4-L18】

## Documentation & Architecture
- `docs/architecture.md` – System context and major components.
- `docs/development-rules.md` – Development workflow and quality expectations.
- `docs/features/appeal-generation/requirements.md` – Requirements for appeal narrative generation.
- `docs/features/appeal-generation/detail-design.md` – Detailed design for appeal narrative generation.
- `docs/features/analysis-intake/requirements.md` – Requirements for AI-assisted analysis intake.
- `docs/features/analysis-intake/detail-design.md` – Detailed design for AI-assisted analysis intake.
- `docs/features/daily-reporting/requirements.md` – Requirements for daily reporting and AI analysis.
- `docs/features/daily-reporting/detail-design.md` – Detailed design for daily reporting services and UI workflow.
- `docs/features/analytics-insights/requirements.md` – Requirements for analytics and continuous improvement.
- `docs/features/analytics-insights/detail-design.md` – Detailed design for analytics and continuous improvement.
- `docs/features/board/requirements.md` – Requirements for the workspace board and collaboration workflows.
- `docs/features/governance/requirements.md` – Governance and competency administration requirements.
- `docs/features/competency-evaluations/requirements.md` – Requirements for the competency evaluation experience.
- `docs/ui-design-system.md` – UI guidelines for shared components.
