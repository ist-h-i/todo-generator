# Todo Generator

Todo Generator is a full-stack productivity workspace that turns free-form notes about bugs,
mistakes, or improvement ideas into structured work. An Angular 20 single-page application pairs
with a FastAPI backend to provide AI-assisted intake, authenticated workspaces, analytics, and
continuous-improvement tooling in one cohesive experience.

## Feature Highlights

- **AI-first intake & triage** – The `/analysis` endpoint calls the ChatGPT Responses API to turn
  free-form notes into validated proposals with titles, summaries, labels, priorities, due-date
  guidance, and subtasks aligned with the backend schema before humans publish new cards.
- **Authenticated workspaces** – Email/password registration, login, and session tokens secure each
  workspace while `/auth/me` exposes the current profile for the frontend to hydrate state.
- **Board collaboration & history** – Card APIs enforce daily creation quotas, manage subtasks,
  labels, initiatives, and similarity scoring, while comments and the activity log capture
  discussions and automated events for every card.
- **Saved filters & layout preferences** – Users persist personalized board layouts and reusable
  search filters to focus kanban views on the most relevant workstreams.
- **Analytics & root-cause intelligence** – Analytics snapshots, Why-Why investigations, and
  suggested actions surface recurring issues, generate remediation plans, and convert actions into
  linked cards when teams are ready to execute.
- **Initiatives & narrative reporting** – Improvement initiatives track progress, health, and linked
  cards, while report templates assemble analytics, root-cause findings, and initiative updates into
  stakeholder-ready narratives.
- **Competency development** – Administrators define competency rubrics, trigger evaluations, and
  respect daily evaluation quotas, with scoring driven by workspace activity to build actionable
  coaching guidance.
- **Admin controls & secure secrets** – Admin endpoints rotate external API credentials, configure
  default quotas, and override per-user limits so teams can tune automation safely.
- **Profile management & avatars** – Users can update nicknames, biographies, and avatars
  URLs, and upload validated avatars directly from the UI, keeping the workspace personable.

## Repository Layout

```
.
├── backend/                # FastAPI service, SQLAlchemy models, and pytest suite
├── frontend/               # Angular 20 application and Tailwind configuration
├── docs/                   # Product requirements and development guidelines
├── scripts/                # Automation helpers (auto-resolve workflow)
└── start-localhost.bat     # Convenience script to boot backend + frontend on Windows
```

Key documentation lives in `docs/`, including development rules and the feature expansion
requirements that describe the product vision in detail.

## Getting Started

### Prerequisites

- Python 3.11+ (for the backend FastAPI service)
- Node.js 20+ and npm (for the Angular frontend)
- SQLite is bundled by default; configure `DATABASE_URL` to use PostgreSQL or another engine.
- An `OPENAI_API_KEY` enables the AI analysis endpoint during local development.

### One-click startup on Windows

Run the included batch script from the repository root:

```
start-localhost.bat
```

The script provisions a virtual environment, installs backend and frontend dependencies, and
launches:

- Backend API at <http://localhost:8000> (interactive docs at `/docs`)
- Frontend app at <http://localhost:4200>

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

2. **Frontend** (in a separate terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```

### Environment variables

The backend automatically creates an SQLite database (`todo.db`) on first run. Configure
additional settings through environment variables defined in `backend/app/config.py`:

- `DATABASE_URL` – SQLAlchemy connection string (default `sqlite:///./todo.db`)
- `DEBUG` – Enable FastAPI debug mode (default `false`)
- `CHATGPT_MODEL` – Logical model name surfaced by the analysis endpoint
- `OPENAI_API_KEY` – Secret used by the backend to authenticate ChatGPT requests
- `ALLOWED_ORIGINS` – Comma-separated list of frontend origins permitted for CORS (default `http://localhost:4200`)
- `SECRET_ENCRYPTION_KEY` – Key used to encrypt stored API credentials; falls back to the ChatGPT key when unspecified.

## Running Tests & Quality Checks

Run the automated test suites before opening a pull request:

```bash
# Backend API tests and linters
pytest backend/tests
ruff check backend
black --check backend/app backend/tests

# Frontend unit tests (Karma) and formatting
cd frontend
npm test
npm run lint
npm run format:check
```

The frontend also supports `npm run build` to produce a production bundle under `dist/`.

If any command above fails, do **not** proceed with your task. Investigate the cause, apply fixes, and rerun the full set of checks until every command completes successfully before considering the work ready for review.

## MCP Server Integration

Workspace-ready settings for [Model Context Protocol](https://modelcontextprotocol.io/) clients are
checked into the repository so compatible tools can register servers immediately via the
`.modelcontext.json` manifest. Any MCP-aware client (including Codex and Claude Code) can read this
file to discover the Git and filesystem servers hosted at the workspace root.
- `.codex/config.json` remains available for Codex’s built-in workspace discovery so existing users
  continue to get automatic registration when opening the repo.

Each configuration registers two servers:

- A Git MCP server launched through `uvx mcp-server-git --repository ${workspaceFolder}` so agents
  can inspect commit history, branches, and diffs without additional setup.
- A filesystem MCP server launched through
  `npx @modelcontextprotocol/server-filesystem ${workspaceFolder}` to expose project files.

Setup checklist:

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) so the `uvx` command is on
   your PATH.
2. Ensure Node.js/npm are installed locally (required for the `npx` command).
3. Install the helper tooling that the automated workflow relies on when running locally:
   ```bash
   npm install eslint retire
   pip install flake8 bandit pytest
   ```
4. Open the repository in your MCP-compatible client. The tool will detect the configuration file it
   understands and start both MCP servers automatically. For other MCP-compatible tools, copy the same
   JSON into the location their documentation specifies.

## Automated Conflict Resolution Workflow

Pull requests benefit from an automated Codex-assisted resolution flow defined in
`.github/workflows/auto-resolve-pr.yml`. The workflow:

1. Sets up Node.js and Python toolchains, installs the Git/filesystem MCP servers, and provisions
   linting, security, and testing dependencies.
2. Executes `scripts/auto_resolve_conflicts.py`, which asks Codex to resolve merge conflicts, stages
   the results, and reruns project tests (backend pytest and frontend npm suites) for up to three
   attempts when failures occur.
3. Runs lint (`eslint` or `flake8`) and security scans (`retire` or `bandit`), followed by the
   appropriate test runner to double-check the final state.
4. Commits, pushes, and (if successful) opens a pull request update using the provided
   `OPENAI_API_KEY` and `GITHUB_TOKEN` secrets.

Store the required OpenAI and GitHub credentials as repository secrets to enable the automation in
your own fork or deployment.

## API & Tooling Highlights

- Swagger UI: <http://localhost:8000/docs>
- `backend/app/main.py` wires routers for analysis, analytics, auth, cards, filters, initiatives,
  reports, competency workflows, admin tooling, and more so the API surface stays modular.
- Activity logging helpers in `backend/app/utils/activity.py` automatically capture meaningful
  changes to cards, subtasks, and analytics artefacts.
- The analysis service in `backend/app/services/chatgpt.py` connects directly to ChatGPT using an
  OpenAI API key and enforces structured JSON responses for predictable integrations.

## Further Reading

- `docs/development-rules.md` – Team expectations for builds, testing, and merge readiness.
- `docs/feature-expansion-requirements.md` – Extended product requirements for analytics,
  reporting, and initiative tracking.
- `backend/README.md` & `frontend/README.md` – Focused guides for each subproject.

Contributions should follow the development rules and keep the README up to date as new features
land.
