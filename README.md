# Verbalize Yourself

Verbalize Yourself is an AI-assisted operations workspace that turns free-form shift notes into structured tasks, analytics, and competency insights. An Angular 20 single-page application collaborates with a FastAPI backend so teams can triage feedback, publish automated proposals, and oversee quotas from one control plane.

## Table of contents
- [Overview](#overview)
- [Architecture at a glance](#architecture-at-a-glance)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
  - [Prerequisites](#prerequisites)
  - [Configure environment variables](#configure-environment-variables)
  - [One-click startup on Windows](#one-click-startup-on-windows)
  - [Manual setup (macoslinux)](#manual-setup-macoslinux)
  - [Run the stack](#run-the-stack)
- [Quality and automation](#quality-and-automation)
  - [Backend commands](#backend-commands)
  - [Frontend commands](#frontend-commands)
  - [Coverage and SonarQube](#coverage-and-sonarqube)
- [Documentation & knowledge base](#documentation--knowledge-base)
- [Troubleshooting](#troubleshooting)

## Overview
| Area | Highlights |
| --- | --- |
| Task operations hub | Drag cards across dynamic board columns, manage subtasks and comments, and apply quick filters powered by the workspace signal store. |
| AI-guided intake | Submit raw notes to `/analysis`, receive JSON-schema validated proposals, and publish accepted cards back to the board in one flow. |
| Status reporting | Compose shift reports, trigger automated analysis, convert generated actions into linked cards, and review submission history. |
| Analytics dashboards | Inspect recurrence trends, root-cause trees, and suggested actions, then promote recommendations into cards without leaving analytics. |
| Governance & competency | Administer API credentials, daily quotas, error categories, and competency evaluations from the admin console. |
| Recommendation scoring | Every created or updated card receives an `ai_confidence` score, human-readable `ai_notes`, and an optional `ai_failure_reason` from the FastAPI scoring service. A deterministic heuristic is in place until a live provider integration ships. |

Gemini powers analyzer, status report, and appeal workflows. Follow the [Gemini migration spec](docs/spec-updates/gemini-migration.md) for configuration and rollout guidance.

## Architecture at a glance
- **Frontend**: Angular standalone components with signal-based state management, Angular CDK drag-and-drop, Tailwind-inspired design tokens, ESLint, and Prettier.
- **Backend**: FastAPI with SQLAlchemy ORM models, layered routers and services, startup migrations, and JSON schema validation for AI responses.
- **Database**: SQLite by default with PostgreSQL support via `DATABASE_URL`.
- **AI integration**: Google Gemini via the `google-generativeai` SDK with strict JSON schema validation.
- **Quality tooling**: pytest, Ruff, Black, Angular unit tests, and ESBuild-driven CLI builds.

Refer to `docs/architecture.md` for an end-to-end component breakdown and `docs/data-flow-overview.md` for request lifecycles across the stack.

## Repository layout
```
.
|-- backend/                # FastAPI application, routers, services, migrations, tests
|   |-- app/
|   |   |-- routers/        # Feature-aligned API routers
|   |   |-- services/       # Domain logic and Gemini integration
|   |   |-- utils/          # Quotas, crypto, repository helpers
|   `-- tests/              # pytest suites mirroring backend modules
|-- frontend/               # Angular SPA with feature-based routing and shared libs
|   `-- src/app/            # Standalone components, signal stores, API clients
|-- docs/                   # Architecture notes, feature specs, governance playbooks
|-- prompts/                # Prompt references for AI interactions
|-- scripts/                # Automation scripts (Codex pipeline, MCP helpers)
|-- start-localhost.bat     # Windows helper that installs deps and launches both servers
`-- start-mcp-servers.bat   # Starts the MCP Git and filesystem helper servers
```

## Local development

### Prerequisites
- Python 3.11 or later with `pip`.
- Node.js 20+ and npm.
- Access to the managed Neon PostgreSQL instance (obtain the connection string from the secure secret store).
- A Gemini API key (Google AI Studio) stored through the admin settings UI.
- Set `SECRET_ENCRYPTION_KEY` to a sufficiently long random value before storing secrets.

### Configure environment variables
Create a `.env` file in the repository root or export variables before launching the backend.

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy connection string. Supply the pooled Neon connection string via environment variables. | (required) |

Store the Neon credentials outside the repository (for example, in a `.env` file that is excluded from version control) and inject them through `DATABASE_URL` before starting the backend service.
| `DEBUG` | Enables verbose logging and exception responses. | `False` |
| `GEMINI_MODEL` | Gemini model identifier for AI-assisted flows. | `models/gemini-2.0-flash` |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Gemini API key. Provide before enabling analyzer or report AI flows. | (required for AI features) |
| `SECRET_ENCRYPTION_KEY` | AES key for encrypting stored secrets. Provide a sufficiently long random value; if unset, the admin console returns HTTP 503 when secrets are accessed. | `verbalize-yourself` (development fallback only) |
| `RECOMMENDATION_WEIGHT_LABEL` | Weight applied to label correlation when computing `ai_confidence`. | `0.6` |
| `RECOMMENDATION_WEIGHT_PROFILE` | Weight applied to profile alignment when computing `ai_confidence`. | `0.4` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS origins for the SPA. | `http://localhost:4200` |

### One-click startup on Windows
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
   Startup migrations run automatically and provision the Neon PostgreSQL schema (or upgrade the configured database).

2. **Frontend** (new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   The Angular dev server provides hot module replacement at http://localhost:4200. Adjust the backend origin in `frontend/src/app/core/api/api.config.ts` if necessary.

### Run the stack
- Login with the seeded administrator account or create a new user via `/auth`.
- Store secrets and Gemini keys through the admin console once `SECRET_ENCRYPTION_KEY` is configured.
- Use `start-mcp-servers.*` to launch the Model Context Protocol helper servers when running Codex automation or MCP tooling.

## Quality and automation
Run the relevant checks before sending changes for review. Documentation-only updates may skip automated checks, but keep README and `docs/` aligned with the latest behavior.

### Backend commands
- `pytest backend/tests`
- `ruff check backend`
- `black --check backend/app backend/tests`

### Frontend commands
- `cd frontend && npm run lint`
- `cd frontend && npm run format:check`
- `cd frontend && npm test -- --watch=false`
- `cd frontend && npm run build`

### Coverage and SonarQube
Generate coverage reports before invoking `sonar-scanner` so SonarQube can display backend and frontend unit test coverage.

```bash
pip install -r backend/requirements-dev.txt  # ensures the coverage package is available
npm install --prefix frontend

./scripts/run_tests_with_coverage.sh
sonar-scanner
```

The helper script runs `coverage run -m pytest` inside `backend/` and `npm run test:ci` in `frontend/`. It emits `backend/coverage.xml` and `frontend/coverage/frontend/lcov.info`, which SonarQube consumes through `sonar-project.properties`.

## Documentation & knowledge base
- [Documentation index](docs/README.md) – curated map of the most frequently referenced specs and playbooks.
- [Architecture overview](docs/architecture.md) – high-level system diagram and component breakdown.
- [Data flow reference](docs/data-flow-overview.md) – end-to-end traces for core workflows.
- [Development rules](docs/development-rules.md) – working agreements, quality bars, and automation hints.
- [System architecture playbook](docs/system-architecture-playbook.md) – reusable principles and workflow guidance for similar products.
- [Security hotspots](docs/security-review.md) – known risks and recommended remediation paths.

## Troubleshooting
### WinError 10055 on Windows
Long-running async workloads (for example, repeated backend test runs) can exhaust Windows socket buffers and raise `OSError: [WinError 10055]`. Close stray processes holding sockets (`Get-NetTCPConnection`), stagger concurrent test runs, or reboot to reclaim ephemeral ports. Consider increasing `MaxUserPort` and reducing `TcpTimedWaitDelay` if you control the environment.

### Gemini 404 errors after submitting `/analysis`
When the backend raises `google.api_core.exceptions.NotFound: 404 models/gemini-2.0-flash is not found for API version v1beta, or is not supported for generateContent`, the Google Generative AI SDK is hitting the legacy `v1beta` API. That endpoint does not expose `gemini-2.0-flash` (or other `2.0` Flash variants), so FastAPI ultimately returns `502 Bad Gateway` to the Angular client.

The stack traces point back to `backend/app/services/gemini.py`, where the client invokes `generate_content()` via gRPC. You may also notice `ALTS creds ignored. Not running on GCP ...` in the logs—this warning is safe to ignore outside Google Cloud.

To recover:

1. **Enumerate supported models** – Run `from google.generativeai import list_models; print(list_models())` in a Python shell to verify which models and methods your account can access. The backend performs this discovery step automatically and will either map `models/gemini-2.0-flash` to an available variant (for example `models/gemini-2.0-flash-002`) or return `503 Service Unavailable` with the supported model names.
2. **Switch to an available model** – Configure `GEMINI_MODEL` (or the admin credential form) with an identifier surfaced by the error, such as `models/gemini-2.0-flash`, `models/gemini-2.0-flash-lite`, or `gemini-1.5-pro-latest`, that your account can access.
3. **Upgrade the SDK for `v1` support** – Install the latest `google-generativeai` release so you can target the `v1` API and restore access to the Flash families if you are pinned to older runtimes.

Re-run the `list_models()` check after each change to confirm the API now exposes the desired model before retrying the `/analysis` workflow.
