# Persistence Detailed Design

## Purpose & Scope
This document captures the detailed plan for moving the workspace's client-only workflows—board management, continuous improvement, reporting, profile/governance, and competency evaluations—onto the FastAPI backend. At present only the card list and AI-generated proposals call the backend through `CardsApiService`, while most workspace mutations are stored exclusively in Angular signals and local storage within `WorkspaceStore`.

The scope covers the following operations:

- Card, subtask, comment editing, drag-and-drop moves, and manual activity log entries on the board.
- Board configuration (column width, grouping, filters/templates, label/status/error-category management).
- Continuous improvement dashboards (snapshots, initiatives, suggested actions).
- Reports and AI workflows (status reports, appeals, analytics-backed narratives).
- Profile and governance settings (profile fields, encrypted admin API credentials, quotas).
- Competency evaluations (definitions, running self-assessments).

## Current Data Sources & Constraints
- The FastAPI backend already exposes models and routers for cards, subtasks, comments, activity logs, board layouts, and saved filters.【F:backend/app/models.py†L120-L439】【F:backend/app/routers/cards.py†L203-L563】【F:backend/app/routers/comments.py†L24-L139】【F:backend/app/routers/activity.py†L12-L76】【F:backend/app/routers/preferences.py†L10-L33】【F:backend/app/routers/filters.py†L15-L104】
- The continuous improvement store currently loads fixtures into Angular signals and only hits the card creation API when converting suggested actions.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】【F:frontend/src/app/core/state/continuous-improvement-fixtures.ts†L1-L79】
- Analysis, status report, profile, admin, and competency evaluation routers already expose CRUD operations; several are in use from the Angular services today.【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/routers/status_reports.py†L1-L117】【F:backend/app/routers/profile.py†L22-L67】【F:backend/app/routers/admin_settings.py†L1-L140】【F:backend/app/routers/competency_evaluations.py†L61-L185】

## Persistence Design
### 1. Board & Task Management
#### 1.1 Cards and Subtasks CRUD
- **API surface**: `/cards` (GET/POST/PUT/DELETE) and `/cards/{card_id}/subtasks` (GET/POST/PUT/DELETE).【F:backend/app/routers/cards.py†L203-L563】
- **Frontend implementation**: extend `CardsApiService` with update/delete operations and add a dedicated `SubtasksApiService`. Mutating methods inside `WorkspaceStore` should call these APIs and refresh the local signals from the responses, applying optimistic updates with rollback on failure.【F:frontend/src/app/core/api/cards-api.service.ts†L45-L192】【F:frontend/src/app/core/state/workspace-store.ts†L1001-L1388】
- **Additional validation**: keep the existing sanitisation in `WorkspaceStore`, surface API errors as toasts/snackbars, and send drag-and-drop operations through `PATCH /cards/{id}`. Backend logic will continue to set `completed_at` when a card moves into a done status.【F:backend/app/routers/cards.py†L36-L145】

#### 1.2 Comments & Activity
- **API surface**: `/comments` (list/create/update/delete) and `/activity-log` (list/create).【F:backend/app/routers/comments.py†L24-L139】【F:backend/app/routers/activity.py†L12-L76】
- **Frontend implementation**: create `CommentsApiService` and call it from `WorkspaceStore.addComment/updateComment/removeComment`. Sync the response IDs after successful writes and fetch the activity log via `/activity-log` when opening the detail drawer. Manual activity log entries should use `ActivityApiService.create` with structured metadata.
- **Caching strategy**: fetch comments/activity when the drawer opens, cache them in a signal, and refetch after writes. Apply a time-based refresh (e.g., five minutes) to avoid stale conversations.

#### 1.3 Board Settings & Saved Filters
- **API surface**: `/board-layouts` via the preferences router and `/saved-filters` for filter CRUD.【F:backend/app/routers/preferences.py†L10-L33】【F:backend/app/routers/filters.py†L15-L104】
- **Frontend implementation**: replace local-storage persistence in `WorkspaceStore.persistSettings`/`persistPreferencesState` with API calls. Submit `BoardLayoutUpdate` payloads containing column widths, visible fields, and notification preferences, then reconcile the response into the signal store.
- **Migration**: when a user opens the board after deployment, migrate existing local-storage values by POST/PATCHing to the API and removing the legacy entries via `migrateLegacySettings`.【F:frontend/src/app/core/state/workspace-store.ts†L2148-L2249】

#### 1.4 Workspace Configuration (Statuses/Labels/Error Categories)
- **API surface**: `/statuses`, `/labels`, `/error-categories` backed by the shared status/label/error models.【F:backend/app/models.py†L170-L236】【F:backend/app/routers/statuses.py†L1-L118】【F:backend/app/routers/labels.py†L1-L108】【F:backend/app/routers/error_categories.py†L1-L100】
- **Frontend implementation**: wrap the existing settings UI with API clients and refetch the workspace settings signal after mutations. Cache read-only lookups and bind them to card creation forms.

### 2. Continuous Improvement & Analytics
- **API surface**: `/analytics/snapshots`, `/analytics/root-causes`, `/analytics/suggestions`, `/improvement-initiatives`, etc.【F:backend/app/routers/analytics.py†L1-L200】【F:backend/app/routers/initiatives.py†L1-L133】【F:backend/app/routers/suggested_actions.py†L1-L136】
- **Frontend implementation**: replace the fixtures consumed by `ContinuousImprovementStore` with API fetches during signal initialisation, and use `convertSuggestedAction` to call `/analytics/suggestions/{id}` PATCH endpoints. Initiative progress updates should use `/improvement-initiatives/{id}/progress` POST.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L32-L200】
- **Caching & polling**: load snapshots at app start (daily cadence) and refetch initiatives after each progress mutation. AI outputs should be persisted server-side through the existing `AnalysisGateway` with future webhook support.

### 3. Reports & AI Workflows
- **API surface**: `/status-reports` for the shift workflow and `/appeals` for narrative generation, alongside the `/reports` router for templated analytics exports.【F:backend/app/routers/status_reports.py†L1-L117】【F:backend/app/routers/appeals.py†L1-L118】【F:backend/app/routers/reports.py†L1-L260】
- **Frontend implementation**: keep using `StatusReportsGateway` but persist drafts, retries, and submission states via API responses. Appeals should call the FastAPI router to create requests, fetch history, and manage templates, reusing the status-report queueing strategy for OpenAI calls.【F:backend/app/services/status_reports.py†L23-L199】【F:backend/app/services/appeals.py†L19-L199】
- **Asynchronous processing**: run report/appeal generation in background tasks (RQ/Celery). The frontend should poll or subscribe via Server-Sent Events for completion updates.

### 4. Profile & Governance
- **API surface**: `/profile/me`, `/admin/api-credentials`, `/admin/quotas`, `/admin/users`, plus related routers for admin governance.【F:backend/app/routers/profile.py†L22-L67】【F:backend/app/routers/admin_settings.py†L1-L140】【F:backend/app/routers/admin_users.py†L1-L147】
- **Frontend implementation**: `ProfileService` already reads `/profile/me`; extend its forms to persist updates directly. Admin tables should call the corresponding `AdminApiService` methods and refresh lists after each mutation.【F:frontend/src/app/features/profile/evaluations/page.ts†L1-L160】【F:frontend/src/app/features/admin/users/users-page.component.ts†L1-L160】
- **Audit trail**: extend the backend to record significant admin changes in `ActivityLog` so governance updates appear in the same audit stream.【F:backend/app/utils/activity.py†L10-L65】

### 5. Competency Evaluations
- **API surface**: `/competencies`, `/competency-evaluations`, `/evaluation-jobs`, and quota endpoints.【F:backend/app/routers/competency_evaluations.py†L61-L185】
- **Frontend implementation**: integrate the existing competency services with backend persistence for definition editing and self-evaluation runs. Check `/users/me/evaluations/limits` before enabling actions and disable buttons when quotas are exhausted.【F:frontend/src/app/features/profile/evaluations/page.ts†L68-L147】
- **History retention**: rely on `CompetencyEvaluation` records to render the history tab. Optionally persist OpenAI evaluation logs via `evaluation_jobs` for richer auditing.【F:backend/app/models.py†L301-L439】

## Synchronisation & Error Handling
1. **Optimistic UI updates** – Update signals immediately, roll back when API calls fail, and show snackbar errors.
2. **Refetch triggers** – After each successful mutation, optionally refetch detailed resources (`GET /cards/{id}`) to keep denormalised data accurate.
3. **Validation mapping** – Preserve frontend sanitisation and surface FastAPI `422` errors on the corresponding form fields.
4. **ID normalisation** – Replace provisional IDs (from `createId()`) with API-issued identifiers after successful creates to support retries.【F:frontend/src/app/core/utils/create-id.ts†L1-L40】
5. **Migration** – Migrate legacy local-storage data to the API on first access, removing local copies once the server is authoritative.

## Next Steps
1. **Expand API clients** – Add update/delete methods to `CardsApiService`, implement services for comments, activity, filters, and board settings, and cover them with unit tests.【F:frontend/src/app/core/api/cards-api.service.ts†L182-L192】
2. **Refactor `WorkspaceStore`** – Rework the signal-based mutations to call APIs, implement rollback logic, and add feature tests for board interactions.【F:frontend/src/app/core/state/workspace-store.ts†L1001-L1388】
3. **Wire continuous improvement UI to the API** – Replace fixture initialisation with real fetches and update tests for card conversion flows.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L32-L200】
4. **Deliver saved filter UI** – Add CRUD screens powered by `/saved-filters` and cover them with end-to-end scenarios.【F:backend/app/routers/filters.py†L15-L104】
5. **Ship the appeals router** – Finalise FastAPI `/appeals` endpoints, persist history, and add frontend forms and status displays.【F:backend/app/routers/appeals.py†L1-L118】
6. **Strengthen audit logging** – Record admin and evaluation operations in `ActivityLog` and surface them through reusable history components.【F:backend/app/utils/activity.py†L10-L65】
7. **Author migration tooling** – Provide scripts/CLI commands to sync existing local settings into the API for current users.

Implementing this plan centralises critical workspace data on the backend, enabling multi-device access, audit compliance, and future automation.
