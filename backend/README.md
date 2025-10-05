# Verbalize Yourself Backend

This FastAPI application implements the backend described in the project requirements. It exposes REST endpoints for analysis, card management, subtasks, labels, statuses, board layouts, comments, and the activity log.

## Features

- FastAPI service with modular routers and automatic OpenAPI documentation.
- SQLAlchemy data models reflecting cards, subtasks, labels, statuses, user preferences, comments, and activity logs.
- SQLite database by default (configurable via the `DATABASE_URL` environment variable).
- Gemini integration that converts free-form text into card proposals using Google AI Studio models.
- CRUD endpoints for all primary entities, including nested operations for subtasks.
- Activity logging to track significant changes.
- Recommendation scoring service that assigns `ai_confidence` and human-readable `ai_notes` on every card mutation, while surfacing `ai_failure_reason` when the heuristic fallback path runs.
- Automated tests using `pytest` and FastAPI's `TestClient`.

## Getting Started

1. **Install dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

   For local development (formatting and linting), install the additional tooling bundle:
   ```bash
   pip install -r backend/requirements-dev.txt
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

6. **Check code style**
   ```bash
   ruff check backend
   black --check backend/app backend/tests
   ```

## Configuration

Configuration is managed through environment variables (see `app/config.py`). Key variables include:

- `DATABASE_URL`: SQLAlchemy connection string. Set this to the pooled Neon connection string via environment variables; the service refuses to start when the placeholder value is left in place.
- `DEBUG`: Enable FastAPI debug mode (default: `False`).
- `GEMINI_MODEL`: Logical name for the Gemini model (default: `models/gemini-2.0-flash`).
- `ALLOWED_ORIGINS`: Comma-separated list of origins allowed to call the API with browser credentials (default: `http://localhost:4200`).
- `SECRET_ENCRYPTION_KEY`: AES key for encrypting stored API credentials. Configure a sufficiently long random value; leaving it unset causes the admin console to return HTTP 503 when managing credentials.
- `RECOMMENDATION_WEIGHT_LABEL`: Weight applied to label correlation when combining recommendation scores (default: `0.6`).
- `RECOMMENDATION_WEIGHT_PROFILE`: Weight applied to profile alignment when combining recommendation scores (default: `0.4`).
- **AI API token**: Manage the Gemini API key from the admin settings screen. The backend reads the encrypted value from the database.

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
│   ├── services/        # External integrations (Gemini client)
│   └── utils/           # Shared helpers (activity logging)
└── tests/
    ├── conftest.py      # Test fixtures and client setup
    └── test_cards.py    # API behaviour tests
```

## API Interface

All endpoints are served under the root path (`/`). Unless otherwise stated the API exchanges JSON payloads encoded as UTF-8 and follows FastAPI's standard error envelope (`{"detail": "..."}`) when returning validation or 404 errors.

### Health

- `GET /health`
  - **Response**: `{ "status": "ok" }`

### Analysis

- `POST /analysis`
  - **Request body (`AnalysisRequest`)**
    - `text` *(string, required)* – Free-form text to analyse.
    - `max_cards` *(integer, optional, default `3`, range 1-10)* – Maximum number of card proposals to generate.
  - **Response (`AnalysisResponse`)**
    - `model` *(string)* – Logical name of the analysis model that produced the result.
    - `proposals` *(array)* – Each entry is an `AnalysisCard` containing:
      - `title` *(string)*
      - `summary` *(string)*
      - `status` *(string, defaults to `"todo"`)*
      - `labels` *(array of strings)*
      - `priority` *(string, defaults to `"medium"`)*
      - `due_in_days` *(integer, nullable)* – Suggested due date relative to now.
      - `subtasks` *(array of `AnalysisSubtask`)* with `title`, optional `description`, and `status` (defaults to `"todo"`).

### Cards

#### Data models

- `CardCreate` / `CardUpdate`
  - `title` *(string, required)*
  - `summary`, `description` *(strings, optional)*
  - `status_id` *(string, optional)* – References a status.
  - `priority` *(string, optional)*
  - `story_points` *(integer, optional)*
  - `estimate_hours` *(number, optional)*
  - `assignees` *(array of strings, defaults to empty list)*
  - `start_date`, `due_date` *(ISO 8601 date-time strings, optional)*
  - `dependencies` *(array of strings, defaults to empty list)*
  - `ai_confidence` *(number between 0 and 100, read-only)* – Calculated on the server from label correlation and profile alignment.
  - `ai_notes` *(string, read-only)* – Explanation describing how the recommendation score was derived.
  - `ai_failure_reason` *(string, read-only)* – Diagnostic code (e.g., `scoring_error`) populated when scoring falls back to safe defaults.
  - `custom_fields` *(object, defaults to empty dict)*
  - `label_ids` *(array of strings, defaults to empty list)* – Relationship to labels.
  - `subtasks` *(array of `SubtaskCreate`, defaults to empty list)* – Only available on create.
- `CardRead`
  - All fields from `CardCreate` plus `id`, `created_at`, `updated_at`, and denormalised relationships: `labels` (array of `LabelRead`), `subtasks` (array of `SubtaskRead`), and `status` (`StatusRead`).
- `SubtaskCreate` / `SubtaskUpdate`
  - `title` *(string, required for create)*
  - `description`, `status`, `priority`, `assignee` *(strings, optional)*
  - `start_date`, `due_date` *(ISO 8601 date-time strings, optional)*
  - `estimate_hours` *(number, optional)*
  - `story_points` *(integer, optional)*
  - `checklist` *(array of objects with `id`, `label`, `done`)*
- `SubtaskRead`
  - Fields from `SubtaskCreate` plus `id`, `created_at`, `updated_at`.

#### Endpoints

- `GET /cards`
  - **Query parameters**: `status_id` (filter by status), `label_id` (filter by label), `search` (case-insensitive substring search on title/summary).
  - **Response**: array of `CardRead` ordered by `created_at` descending.
- `POST /cards`
  - **Request body**: `CardCreate`. Client-supplied values for `ai_confidence`, `ai_notes`, and `ai_failure_reason` are ignored.
  - **Response**: `CardRead` of the newly created card (HTTP 201).
- `GET /cards/{card_id}`
  - **Response**: `CardRead` for the requested card.
- `PUT /cards/{card_id}`
  - **Request body**: `CardUpdate` (partial update, omit fields to leave unchanged). When card metadata changes, the backend recalculates the recommendation score and overwrites the read-only AI fields.
  - **Response**: Updated `CardRead`.
- `DELETE /cards/{card_id}`
  - **Response**: Empty body (HTTP 204) on success.
- `GET /cards/{card_id}/subtasks`
  - **Response**: array of `SubtaskRead` for the card.
- `POST /cards/{card_id}/subtasks`
  - **Request body**: `SubtaskCreate`.
  - **Response**: `SubtaskRead` for the newly created subtask (HTTP 201).
- `PUT /cards/{card_id}/subtasks/{subtask_id}`
  - **Request body**: `SubtaskUpdate` (partial update).
  - **Response**: Updated `SubtaskRead`.
- `DELETE /cards/{card_id}/subtasks/{subtask_id}`
  - **Response**: Empty body (HTTP 204).

### Labels

- **Data models**
  - `LabelCreate` / `LabelUpdate`: `name` (string, required), optional `color`, `description`, `is_system` (boolean).
  - `LabelRead`: fields from create plus `id`.
- **Endpoints**
  - `GET /labels` → array of `LabelRead` ordered by name.
  - `POST /labels` → create from `LabelCreate`, responds with `LabelRead` (HTTP 201).
  - `PUT /labels/{label_id}` → partial update via `LabelUpdate`, responds with `LabelRead`.
  - `DELETE /labels/{label_id}` → empty response (HTTP 204).

### Statuses

- **Data models**
  - `StatusCreate` / `StatusUpdate`: `name` (string, required), optional `category`, `order` (integer), `color` (string), `wip_limit` (integer ≥ 0).
  - `StatusRead`: fields from create plus `id`.
- **Endpoints**
  - `GET /statuses` → array of `StatusRead` ordered by `order` then name.
  - `POST /statuses` → create from `StatusCreate`, responds with `StatusRead` (HTTP 201).
  - `PUT /statuses/{status_id}` → partial update via `StatusUpdate`, responds with `StatusRead`.
  - `DELETE /statuses/{status_id}` → empty response (HTTP 204).

### Board Layouts (User Preferences)

- **Data models**
  - `BoardLayoutUpdate`: `user_id` (string, required), optional `board_grouping`, `board_layout` (object), `visible_fields` (array of strings), `notification_settings` (object), `preferred_language` (string).
  - `UserPreferenceRead`: fields above plus `user_id`, `created_at`, `updated_at`.
- **Endpoints**
  - `GET /board-layouts`
    - **Query parameter**: `user_id` (string, required).
    - **Response**: `UserPreferenceRead`; creates a default record when one does not exist.
  - `PUT /board-layouts`
    - **Request body**: `BoardLayoutUpdate`.
    - **Response**: Updated `UserPreferenceRead`.

### Comments

- **Data models**
  - `CommentCreate`: `card_id` (string, required), `content` (string, required), optional `author_id`.
  - `CommentRead`: fields from create plus `id`, `created_at`.
- **Endpoints**
  - `GET /comments`
    - **Query parameter**: optional `card_id` to filter.
    - **Response**: array of `CommentRead` ordered by creation time.
  - `POST /comments` → create from `CommentCreate`, responds with `CommentRead` (HTTP 201).
  - `DELETE /comments/{comment_id}` → empty response (HTTP 204).

### Activity Log

- **Data models**
  - `ActivityCreate`: optional `card_id`, optional `actor_id`, required `action` (string), optional `details` (object).
  - `ActivityLogRead`: fields from create plus `id` and `created_at`.
- **Endpoints**
  - `GET /activity-log`
    - **Query parameters**: optional `card_id`, `limit` (integer, default 100, max 500).
    - **Response**: array of `ActivityLogRead` ordered by newest first.
  - `POST /activity-log` → create from `ActivityCreate`, responds with `ActivityLogRead` (HTTP 201).

### Recommendation scoring lifecycle

- Card creation and updates call `RecommendationScoringService.score_card` with the title, summary, description, label names, and the requester's profile. The service tokenises content, measures cosine similarity against board labels and profile metadata, and combines the subscores using the configured weights.【F:backend/app/routers/cards.py†L93-L120】【F:backend/app/services/recommendation_scoring.py†L59-L124】【F:backend/app/services/recommendation_scoring.py†L197-L217】
- Successful runs emit an integer score (`ai_confidence`) alongside Japanese explanations that summarise label correlation and profile alignment. Missing metadata triggers helper text in the generated notes.【F:backend/app/services/recommendation_scoring.py†L95-L118】【F:backend/app/services/recommendation_scoring.py†L208-L217】
- Exceptions fall back to a zero score, preserve execution flow, and stamp `ai_failure_reason="scoring_error"` so clients can surface diagnostics without exposing stack traces.【F:backend/app/services/recommendation_scoring.py†L108-L124】【F:backend/app/routers/cards.py†L369-L482】

## Notes

- The Gemini integration requires a valid Gemini API key. If the key is missing the `/analysis` endpoint returns HTTP 503. When
  configured, the backend calls Google AI Studio and enforces the response schema via structured outputs.
- Authentication and real-time collaboration are not yet implemented but the architecture leaves room for future expansion.
