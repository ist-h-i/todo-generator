# Todo Generator

Todo Generator is a full-stack reference implementation of a productivity system that turns
free-form notes about bugs, mistakes, or improvement ideas into structured work. The project
contains an Angular 20 single-page application and a FastAPI backend that collaborates to
capture AI-generated task proposals, manage kanban-style boards, explore analytics, and produce
continuous-improvement reports.

## Key Capabilities

- **AI-first intake & triage** – The `/analysis` endpoint calls the ChatGPT Responses API to
  convert free-form notes into validated proposals with titles, summaries, labels, priority,
  due-date guidance, and subtasks that align with the backend schema before humans approve
  new cards.
- **Collaborative board & filtering** – Cards capture statuses, labels, priorities, assignees,
  error categories, initiatives, subtasks, comments, and activity history, while saved filters,
  advanced search facets, and workspace preferences keep the kanban board focused on the
  highest-impact work.
- **Similarity & analytics intelligence** – Analytics snapshots, multi-depth Why-Why analyses,
  and `/cards/{id}/similar` recommendations surface recurring issues, related cards and
  subtasks, and the error categories driving them so teams can diagnose patterns faster.
- **Guided improvements & initiatives** – Suggested actions store effort and impact metadata,
  convert into linked cards in one click, and roll up to improvement initiatives with progress
  logs and health metrics to keep remediation plans on track.
- **Narrative reporting & storytelling** – Report templates and the generator blend analytics
  highlights, root-cause findings, initiative updates, and action plans into shareable
  narratives ready for stakeholders.
- **Extensible architecture & tooling** – FastAPI routers expose typed OpenAPI endpoints,
  the Angular 20 frontend leans on signal-first patterns with Tailwind-powered dark mode, and
  automation hooks (activity logging, MCP manifests, conflict-resolution workflows) make the
  stack integration friendly.

## Repository Layout

```
.
├── backend/                # FastAPI service, SQLAlchemy models, and pytest suite
├── frontend/               # Angular 20 application and Tailwind configuration
├── docs/                   # Product requirements and development guidelines
└── start-localhost.bat     # Convenience script to boot backend + frontend on Windows
```

Key documentation lives in `docs/`, including development rules and the feature expansion
requirements that describe the product vision in detail.

## Getting Started

### Prerequisites

- Python 3.11+ (for the backend FastAPI service)
- Node.js 20+ and npm (for the Angular frontend)
- SQLite is bundled by default; configure `DATABASE_URL` to use PostgreSQL or another engine.

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
   uvicorn app.main:app --app-dir backend --reload
   ```

2. **Frontend** (in a separate terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```

The backend automatically creates an SQLite database (`todo.db`) on first run. Configure
additional settings through environment variables defined in `backend/app/config.py`:

- `DATABASE_URL` – SQLAlchemy connection string (default `sqlite:///./todo.db`)
- `DEBUG` – Enable FastAPI debug mode (default `false`)
- `CHATGPT_MODEL` – Logical model name surfaced by the analysis endpoint
- `OPENAI_API_KEY` – Secret used by the backend to authenticate ChatGPT requests
- `ALLOWED_ORIGINS` – Comma-separated list of frontend origins permitted for CORS (default `http://localhost:4200`)

## Running Tests & Quality Checks

Run the automated test suites before opening a pull request:

```bash
# Backend API tests
pytest backend/tests

# Frontend unit tests (Karma)
cd frontend
npm test
```

The frontend also supports `npm run build` to produce a production bundle under `dist/`.

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
- Activity logging helpers in `backend/app/utils/activity.py` automatically capture meaningful
  changes to cards, subtasks, and analytics artefacts.
- The analysis service in `backend/app/services/chatgpt.py` connects directly to ChatGPT using
  an OpenAI API key and enforces structured JSON responses for predictable integrations.

## Further Reading

- `docs/development-rules.md` – Team expectations for builds, testing, and merge readiness.
- `docs/feature-expansion-requirements.md` – Extended product requirements for analytics,
  reporting, and initiative tracking.
- `backend/README.md` & `frontend/README.md` – Focused guides for each subproject.

Contributions should follow the development rules and keep the README up to date as new features
land.
