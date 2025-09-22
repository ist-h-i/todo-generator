# Todo Generator

Todo Generator is a full-stack reference implementation of a productivity system that turns
free-form notes about bugs, mistakes, or improvement ideas into structured work. The project
contains an Angular 20 single-page application and a FastAPI backend that collaborates to
capture AI-generated task proposals, manage kanban-style boards, explore analytics, and produce
continuous-improvement reports.

## Key Capabilities

- **AI-assisted capture** – The `/analysis` endpoint wraps a deterministic ChatGPT stub that
  converts multi-paragraph input into titled cards, suggested labels, priorities, due date
  hints, and starter subtasks ready for human review.
- **Rich task management** – REST endpoints for cards, subtasks, statuses, labels, saved
  filters, and board layouts power the drag-and-drop workspace board, inline editing, and
  comment/activity history surfaces in the frontend.
- **Analytics & root-cause exploration** – Persist analytics snapshots, run Why-Why analyses,
  classify error categories, and surface similar work so teams can understand recurring issues
  before converting insights into action.
- **Suggested actions & initiatives** – Track improvement initiatives, capture progress logs,
  and manage AI-authored suggested actions so remedial plans stay connected to the original
  problem statements.
- **Narrative reporting** – Compose stakeholder-ready reports from templates that blend
  analytics highlights, root-cause findings, initiative status, and recommended next steps into
  a single exportable document.
- **Extensible architecture** – FastAPI provides typed schemas, modular routers, and automatic
  OpenAPI docs, while the Angular frontend applies a signal-first design system with dark mode,
  accessibility landmarks, and Tailwind-powered layouts.

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

## API & Tooling Highlights

- Swagger UI: <http://localhost:8000/docs>
- Activity logging helpers in `backend/app/utils/activity.py` automatically capture meaningful
  changes to cards, subtasks, and analytics artefacts.
- The analysis stub in `backend/app/services/chatgpt.py` keeps local development deterministic
  while mimicking the shape of a real ChatGPT integration.

## Further Reading

- `docs/development-rules.md` – Team expectations for builds, testing, and merge readiness.
- `docs/feature-expansion-requirements.md` – Extended product requirements for analytics,
  reporting, and initiative tracking.
- `backend/README.md` & `frontend/README.md` – Focused guides for each subproject.

Contributions should follow the development rules and keep the README up to date as new features
land.
