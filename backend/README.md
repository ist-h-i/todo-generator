# Todo Generator Backend

This FastAPI application implements the backend described in the project requirements. It exposes REST endpoints for analysis, card management, subtasks, labels, statuses, board layouts, comments, and the activity log.

## Features

- FastAPI service with modular routers and automatic OpenAPI documentation.
- SQLAlchemy data models reflecting cards, subtasks, labels, statuses, user preferences, comments, and activity logs.
- SQLite database by default (configurable via the `DATABASE_URL` environment variable).
- Stubbed ChatGPT client that deterministically converts free-form text into card proposals for local development.
- CRUD endpoints for all primary entities, including nested operations for subtasks.
- Activity logging to track significant changes.
- Automated tests using `pytest` and FastAPI's `TestClient`.

## Getting Started

1. **Install dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Run database migrations (optional)**

   The database schema is created automatically on application startup. Alembic is included in the dependencies for future migrations.

3. **Start the API server**
   ```bash
   uvicorn app.main:app --reload --app-dir backend
   ```

4. **Interact with the API**

   - OpenAPI docs: `http://localhost:8000/docs`
   - Health check: `GET http://localhost:8000/health`

5. **Run tests**
   ```bash
   pytest backend/tests
   ```

## Configuration

Configuration is managed through environment variables (see `app/config.py`). Key variables include:

- `DATABASE_URL`: SQLAlchemy connection string. Defaults to `sqlite:///./todo.db`.
- `DEBUG`: Enable FastAPI debug mode (default: `False`).
- `CHATGPT_MODEL`: Logical name for the ChatGPT model stub (default: `gpt-4o-mini`).

## Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI application entry point
│   ├── config.py        # Pydantic settings
│   ├── database.py      # SQLAlchemy engine/session
│   ├── models.py        # ORM models
│   ├── schemas.py       # Pydantic schemas
│   ├── routers/         # API routers (analysis, cards, labels, etc.)
│   ├── services/        # External integrations (ChatGPT stub)
│   └── utils/           # Shared helpers (activity logging)
└── tests/
    ├── conftest.py      # Test fixtures and client setup
    └── test_cards.py    # API behaviour tests
```

## Notes

- The ChatGPT integration is stubbed for now; replace `services/chatgpt.py` with a real client when credentials are available.
- Authentication and real-time collaboration are not yet implemented but the architecture leaves room for future expansion.
