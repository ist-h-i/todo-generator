# Persistence Detailed Design

## Scope and current status
This document explains how the workspace persists data across board management, analytics, reporting, governance, and competency evaluations. The Angular client now relies on the FastAPI backend for all mutations: cards, subtasks, comments, workspace configuration, analytics artifacts, reports, appeals, and competency workflows are committed through API services. Local storage remains as an optimistic cache for board preferences and settings, but the backend is the source of truth.

## 1. Board and task management
### 1.1 Cards and subtasks
- **API surface**: `backend/app/routers/cards.py` exposes `GET /cards`, `POST /cards`, `GET /cards/{card_id}`, `PUT /cards/{card_id}`, and `DELETE /cards/{card_id}`. Subtasks are managed through nested endpoints (`/cards/{card_id}/subtasks` with GET/POST/PUT/DELETE) and a similarity helper at `/cards/{card_id}/similar`.
- **Frontend integration**: `frontend/src/app/core/api/cards-api.service.ts` wires these endpoints into `WorkspaceStore`. Mutations in `WorkspaceStore` perform optimistic updates, then reconcile with the response payload returned by the backend.
- **Data normalisation**: Response mappers (`mapCardFromResponse`, `mapSubtaskFromResponse`) convert API schemas to internal signal models, ensure UUIDs, and guard against missing status IDs by falling back to `WorkspaceSettings.defaultStatusId`.

### 1.2 Comments and activity
- **API surface**: `backend/app/routers/comments.py` provides comment CRUD (`/comments`). `backend/app/routers/activity.py` records manual log entries via `/activity-log`.
- **Frontend integration**: `frontend/src/app/core/api/comments-api.service.ts` and helpers inside `WorkspaceStore` manage comment insertion, optimistic removal, and rollback on error. Activity entries are pulled when opening the detail drawer and cached in the card state.

### 1.3 Workspace settings and saved filters
- **Board layouts**: `/board-layouts` (router `backend/app/routers/preferences.py`) stores per-user column order, widths, and notification preferences. `WorkspaceStore` reads local storage on bootstrap, then upserts current preferences through API calls.
- **Saved filters**: `/filters` (`backend/app/routers/filters.py`) persists named filter sets with optional sharing flags. Filter helpers in `WorkspaceStore` migrate legacy local storage values by POSTing or PATCHing them on first load.
- **Local cache**: Settings and preferences remain mirrored in local storage (`WorkspaceStore.persistSettings` and `persistPreferences`) so the UI can render instantly while network calls complete.

### 1.4 Workspace configuration
- **Statuses, labels, templates**: `/statuses`, `/labels`, and `/workspace/templates` are handled by dedicated routers. The Angular settings page (`frontend/src/app/features/settings/page.ts`) uses `WorkspaceConfigApiService` to create, update, and delete records. `WorkspaceStore.refreshWorkspaceConfig` fetches authoritative lists and harmonises cached defaults, label IDs, and template confidence thresholds.
- **Ordering**: Status order is derived from the `order` column in the database. The current UI appends new statuses at the end (see `WorkspaceStore.addStatus`) and relies on backend sorting when rendering columns.

## 2. Analytics and continuous improvement
- **Snapshots and analyses**: `/analytics` (`backend/app/routers/analytics.py`) returns analytics snapshots, root-cause analyses, and token usage metrics. Data is eager-loaded with `selectinload` to hydrate relationships efficiently.
- **Improvement initiatives**: `/initiatives` links analytics insights to ongoing improvement work. `ContinuousImprovementStore` maps initiatives into board-friendly payloads and resolves initiative assignments during card creation.
- **Suggested actions**: `/suggested-actions` exposes AI recommendations derived from analytics. Operators can promote actions into cards via `WorkspaceStore.createCardFromSuggestion`, which records the origin suggestion ID for traceability.

## 3. Reports and AI workflows
### 3.1 Analyzer intake
- `/analysis` processes `AnalysisRequest` payloads. `services/gemini.py` builds prompts with profile metadata, validates JSON responses, and returns normalised proposals. Errors raise `GeminiError` with HTTP 502/503 codes, preserving graceful UI fallbacks.
- The analyzer page (`frontend/src/app/features/analyze/page.ts`) filters proposals client-side and publishes accepted cards via `WorkspaceStore.publishProposals`.

### 3.2 Status reports
- `/status-reports` manages shift report drafts, submissions, and AI processing. `StatusReportService` (`backend/app/services/status_reports.py`) normalises sections, records lifecycle events, invokes Gemini for summaries, and caps generated card counts.
- Generated proposals are returned alongside `StatusReportDetail`. The frontend (`frontend/src/app/features/reports/reports-page.component.ts`) displays the audit trail and allows promoting proposals into cards through `WorkspaceStore` helpers.

### 3.3 Report templates and narratives
- `/reports` handles templates (`ReportTemplate`), generated reports (`GeneratedReport`), and formatting utilities that combine analytics snapshots, analyses, and initiatives into human-readable summaries.
- `_format_metrics`, `_format_analysis`, and related helpers convert JSON metrics into paragraphs before saving or returning responses.

### 3.4 Appeals
- `/appeals` and `services/appeals.py` generate Japanese-language appeal narratives based on provided cases. Generated content is stored with provenance data, and errors surface descriptive HTTP responses.

## 4. Profile, governance, and quotas
- **Profile**: `/profile` returns enriched `UserProfile` objects, combining base user fields with quota usage, evaluations, and admin hints. Prompts leverage this data to personalise AI interactions.
- **Admin users**: `/admin/users` lets administrators view aggregated quota usage, toggle roles, and set per-user overrides. `utils.quotas` merges global defaults (`QuotaDefaults`) with overrides on demand.
- **Admin settings**: `/admin/api-credentials/{provider}` encrypts secrets with AES-GCM (`utils.secrets`) using `SECRET_ENCRYPTION_KEY`. Quota defaults are configured through `/admin/quotas/defaults`; overrides live at `/admin/quotas/{user_id}`.
- **Error categories**: `/error-categories` keeps taxonomy data aligned between analytics and the board.

## 5. Competency evaluations
- **Competency definitions**: `/admin/competencies` manages competency rubrics, prompt templates, and evaluation jobs. Admins can trigger new evaluations for any workspace member.
- **User-facing evaluations**: `/users/me/evaluations` surfaces personal history, quota status, and allows self-service evaluations. Daily limits are enforced through `reserve_daily_quota` and `get_evaluation_daily_limit` helpers.
- **Evaluator service**: `services/competency_evaluator.py` builds prompts, validates responses, records token usage, and persists `CompetencyEvaluation` and `EvaluationJob` rows with summary statistics.

## 6. Data integrity and migrations
- `backend/app/migrations.py` applies idempotent startup migrations: seeding defaults, backfilling new columns, promoting the first registered user to admin, and ensuring denormalised tables stay in sync.
- SQLAlchemy relationships use `selectinload` and explicit cascade rules to prevent orphan rows (for example, deleting a card cascades to subtasks and comments).
- Utility helpers in `utils.repository` encapsulate common CRUD sequences (save, update via `apply_updates`, ensure ownership) to reduce duplication and accidental inconsistencies.

## 7. Caching and offline resilience
- `WorkspaceStore` stores workspace settings and board preferences in local storage under user-scoped keys. When the active user changes, cached values are reloaded, reconciled with server responses, and written back.
- Analyzer and report submission forms keep transient state in signals, so restarts hand off to the backend without data loss once proposals are published.

## 8. Testing coverage
- Backend persistence paths are exercised in `backend/tests/test_cards.py`, `test_comments.py`, `test_status_reports.py`, `test_workspace_templates.py`, and `test_migrations.py`, ensuring migrations and CRUD flows remain stable.
- Frontend persistence logic is validated through signal store unit tests (`frontend/src/app/core/state` specs) and integration-style tests for analyzer and admin flows.

This design ensures every mutable workflow now round-trips through the backend while still delivering responsive UX through client-side caching and optimistic updates.
