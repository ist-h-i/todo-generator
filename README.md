# Verbalize Yourself

Verbalize Yourself is an AI-assisted operations workspace that turns free-form shift notes into structured tasks, analytics, and competency insights. An Angular 20 single-page application collaborates with a FastAPI backend so teams can triage feedback, publish automated proposals, and oversee quotas from one control plane.

## Highlights
- Task operations hub: drag cards across dynamic board columns, manage subtasks and comments, and apply quick filters powered by the workspace signal store.
- AI-guided intake: submit raw notes to `/analysis`, receive JSON-schema validated proposals, and publish accepted cards back to the board in one flow.
- Status reporting: compose shift reports, trigger automated analysis, convert generated actions into linked cards, and review submission history.
- Analytics dashboards: inspect recurrence trends, root-cause trees, and suggested actions, then promote recommendations into cards without leaving analytics.
- Governance and competency management: administer API credentials, daily quotas, error categories, and competency evaluations from the admin console.
- Heuristic recommendation scoring: every created or updated card receives an `ai_confidence` score, human-readable `ai_notes`, and an optional `ai_failure_reason` from the FastAPI scoring service, which currently relies on deterministic token similarity until a live provider integration ships.

## Technology Stack
- Frontend: Angular standalone components with signal-based state management, Angular CDK drag-and-drop, Tailwind-inspired design tokens, ESLint, and Prettier.
- Backend: FastAPI with SQLAlchemy ORM models, layered routers and services, startup migrations, and JSON schema validation for AI responses.
- Database: SQLite by default with PostgreSQL support via `DATABASE_URL`.
- AI integration: Gemini now powers analyzer, status report, and appeal workflows. Follow the [Gemini migration spec](docs/spec-updates/gemini-migration.md) for configuration and rollout guidance.
- Quality tooling: pytest, Ruff, Black, Angular unit tests, and Nx/ESBuild driven builds.

## Repository Layout
```
.
|-- backend/                # FastAPI application, routers, services, migrations, tests
|-- frontend/               # Angular SPA with feature-based routing
|-- docs/                   # Architecture notes, feature specs, playbooks
|-- prompts/                # Prompt references for AI interactions
|-- scripts/                # Automation scripts (Codex pipeline, MCP helpers)
|-- start-localhost.bat     # Windows helper that installs deps and launches both servers
`-- start-mcp-servers.bat   # Starts the MCP Git and filesystem helper servers
```

## Getting Started
### Prerequisites
- Python 3.11 or later with `pip`.
- Node.js 20+ and npm.
- SQLite (bundled) or a PostgreSQL instance.
- A Gemini API key (Google AI Studio) stored through the admin settings UI.
- Optionally set `SECRET_ENCRYPTION_KEY` for encrypting stored secrets.

### Environment Variables
Create a `.env` file in the repository root or export variables before launching the backend.

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy connection string. Use PostgreSQL for production workloads. | `sqlite:///./todo.db` |
| `DEBUG` | Enables verbose logging and exception responses. | `False` |
| `GEMINI_MODEL` | Gemini model identifier for AI-assisted flows. | `models/gemini-1.5-flash` |
| `SECRET_ENCRYPTION_KEY` | AES key for encrypting stored secrets. | `verbalize-yourself` |
| `RECOMMENDATION_WEIGHT_LABEL` | Weight applied to label correlation when computing `ai_confidence`. | `0.6` |
| `RECOMMENDATION_WEIGHT_PROFILE` | Weight applied to profile alignment when computing `ai_confidence`. | `0.4` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS origins for the SPA. | `http://localhost:4200` |

### Windows one-click setup
Run the bundled script from the repository root. It creates a virtual environment, installs Python and npm dependencies, and launches both servers in separate terminals.

```
start-localhost.bat
```

The backend starts on http://localhost:8000 (with auto-applied migrations and `/docs` for Swagger) and the Angular dev server runs on http://localhost:4200.

### Manual setup (macOS/Linux)
1. **Backend**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   pip install -r backend/requirements-dev.txt  # optional tooling
   uvicorn app.main:app --reload --app-dir backend
   ```
   Startup migrations run automatically and create the SQLite database or upgrade your configured database schema.

2. **Frontend** (new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   The Angular dev server provides hot module replacement at http://localhost:4200. Adjust the backend origin in `frontend/src/app/core/api/api.config.ts` if necessary.

## Quality Checks
Run the relevant checks before sending changes for review:
- `pytest backend/tests`
- `ruff check backend`
- `black --check backend/app backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run format:check`
- `cd frontend && npm test -- --watch=false`
- `cd frontend && npm run build`

Documentation-only updates may skip automated checks, but keep README and `docs/` aligned with the latest behavior.

## Documentation and Scripts
- Architecture and feature deep-dives live under `docs/` (start with `docs/architecture.md`).
- `docs/development-rules.md` captures workflow expectations, test strategy, and PR guidelines.
- Prompt reference files for AI orchestration are stored under `prompts/`.
- `scripts/run_codex_pipeline.sh` runs the Codex automation pipeline; `start-mcp-servers.*` launches Model Context Protocol helper servers.

### Documentation quick links
- [Documentation index](docs/README.md) – curated map of the most frequently referenced specs and playbooks.
- [Architecture overview](docs/architecture.md) – high-level system diagram and component breakdown.
- [Data flow reference](docs/data-flow-overview.md) – end-to-end traces for core workflows.
- [Known issues](docs/known-issues.md) – outstanding UX and engineering gaps to factor into planning.
- [Development rules](docs/development-rules.md) – working agreements, quality bars, and automation hints.

## Troubleshooting
### WinError 10055 on Windows
Long-running async workloads (for example, repeated backend test runs) can exhaust Windows socket buffers and raise `OSError: [WinError 10055]`. Close stray processes holding sockets (`Get-NetTCPConnection`), stagger concurrent test runs, or reboot to reclaim ephemeral ports. Consider increasing `MaxUserPort` and reducing `TcpTimedWaitDelay` if you control the environment.

### Gemini 404 errors after submitting `/analysis`
If the backend logs `models/gemini-1.5-flash-latest is not found for API version v1beta`, the local environment is using the `google-generativeai` 0.5 SDK, which still targets the `v1beta` API. That API does not expose the `gemini-1.5-flash-latest` alias, so requests fail with HTTP 404. Configure the model as `models/gemini-1.5-flash` (the default value exposed by the admin screen and `GEMINI_MODEL`) or upgrade the SDK to a release that talks to the `v1` endpoint before switching to the `-latest` alias.

