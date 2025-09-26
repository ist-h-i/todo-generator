# Verbalize Yourself

Verbalize Yourself is an AI-assisted operations workspace that turns free-form shift notes into structured tasks, analytics, and reports. The platform pairs an Angular 20 single-page application with a FastAPI backend so teams can capture board activity, request AI generated work items, and keep administrators in control of quotas and governance rules.

## Key Capabilities
- **Workspace board** – Drag cards between custom statuses or label groups, filter with quick toggles, and review subtasks alongside inline comments and activity timelines managed by the workspace signal store.
- **AI-assisted analysis intake** – Submit raw notes from the input page, let the backend enrich the request with profile metadata, and receive JSON-schema validated proposals with cards and subtasks from the ChatGPT client.
- **Status reports & automation** – Compose report sections, trigger AI processing, and capture generated cards that stay linked back to the originating report for auditing.
- **Analytics and continuous improvement** – Administrators snapshot metrics, run Why-Why investigations, and monitor suggested actions, all backed by SQLAlchemy models and dedicated REST routers.
- **Governance & competency management** – Configure competencies, quotas, and encrypted API credentials through admin settings, and let members launch self-evaluations from the profile area.

## Technology Stack
- **Frontend** – Angular 20 standalone components, Angular CDK drag-and-drop, signal-based state management, and ESLint/Prettier tooling.
- **Backend** – FastAPI with SQLAlchemy ORM models, service layer orchestration, and startup migrations that keep SQLite or PostgreSQL schemas aligned automatically.
- **AI Integration** – `ChatGPTClient` wraps the OpenAI Responses API, validates responses against strict JSON schemas, and provides fallbacks when proposals cannot be generated.

## Repository Layout
```
.
├── backend/                # FastAPI application, routers, services, and models
├── frontend/               # Angular SPA with feature-based route organization
├── docs/                   # Architecture notes, feature specs, and known issues
├── scripts/                # Utility scripts (e.g. conflict resolution helpers)
└── start-localhost.bat     # Windows helper that installs deps and launches both apps
```

## Getting Started
### Prerequisites
- Python 3.11+ with `pip` for the backend runtime and tooling.
- Node.js 20+ and npm for the Angular CLI scripts.
- SQLite (bundled) or a PostgreSQL database URL for persistent storage.
- An OpenAI API key stored through the admin settings UI so AI-assisted flows can call ChatGPT.
- Optionally set `SECRET_ENCRYPTION_KEY` to encrypt stored API credentials instead of using the default fallback.

### Environment Variables
Create a `.env` file in the repository root or export variables before launching the backend. Common settings include:

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy connection string. Use PostgreSQL for production workloads. | `sqlite:///./todo.db` |
| `DEBUG` | Enables verbose logging and exception responses. | `False` |
| `CHATGPT_MODEL` | OpenAI model name used by the ChatGPT client. | `gpt-4o-mini` |
| `SECRET_ENCRYPTION_KEY` | AES key for encrypting stored secrets. | `verbalize-yourself` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS origins for the SPA. | `http://localhost:4200` |

### One-click startup on Windows
Run the bundled script from the repository root. It creates a virtual environment, installs Python and npm dependencies, and launches both servers in separate terminals.

```
start-localhost.bat
```

The backend starts on <http://localhost:8000> (with auto-applied migrations and `/docs` for Swagger) and the Angular dev server runs on <http://localhost:4200>.

### Manual startup (macOS/Linux)
1. **Backend**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   # Optional tooling
   pip install -r backend/requirements-dev.txt
   uvicorn app.main:app --reload --app-dir backend
   ```
   Startup migrations run automatically and create the SQLite database or upgrade your configured database schema.

2. **Frontend** (new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   The Angular dev server provides hot module replacement at <http://localhost:4200>.

### Running Tests & Quality Checks
Execute the relevant checks before opening a pull request. Use the focused commands when you only touched documentation.

```bash
# Backend
pytest backend/tests
ruff check backend
black --check backend/app backend/tests

# Frontend
cd frontend
npm test -- --watch=false --runInBand --testEnvironment=jsdom
npm run lint
npm run format:check
npm run build
```
The backend suite uses pytest and httpx, while the frontend relies on the Angular CLI (Karma/Jasmine) plus ESLint and Prettier.

## Additional Documentation
- `docs/architecture.md` – System architecture, routing, and key flows.
- `docs/development-rules.md` – Workflow expectations and required quality checks.
- `docs/features/` – Feature-level requirements and detailed designs.
- `docs/known-issues.md` – Outstanding UI and UX issues tracked for follow-up.

Refer to these documents whenever updating features so specifications, rules, and implementation details remain aligned.
