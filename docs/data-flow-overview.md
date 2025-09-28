# Feature Data Flow Reference

This document explains how the main user-facing workflows traverse the Angular UI, front-end state management, FastAPI routers, and SQLAlchemy models until data is persisted in the database. Use it as a map when you need to trace a regression or extend existing behavior.

## 1. Board and Task Operations

### 1.1 Card lifecycle
- On the kanban board, moving cards, opening the drawer, and submitting inline forms call into `WorkspaceStore` methods such as `updateCardStatus`, `saveCardDetails`, and `removeCard`, all triggered from the board page component’s handlers (`moveCard`, `handleDrop`, and `confirmDeleteCard`).【F:frontend/src/app/features/board/page.ts†L330-L408】【F:frontend/src/app/features/board/page.ts†L505-L520】
- `WorkspaceStore` prepares sanitized update payloads, persists optimistic UI state, and forwards mutations through `CardsApiService`, which issues REST calls against `/cards` and nested subtask routes.【F:frontend/src/app/core/state/workspace-store.ts†L1340-L1399】【F:frontend/src/app/core/state/workspace-store.ts†L2101-L2144】【F:frontend/src/app/core/api/cards-api.service.ts†L223-L270】
- The FastAPI router validates ownership, enforces quota limits, recalculates AI scores, and records activity logs before committing `Card` and `Subtask` rows (plus label associations) via SQLAlchemy.【F:backend/app/routers/cards.py†L245-L515】 The ORM model maps the persisted fields, relationships, and cascading deletes for cards and their subtasks.【F:backend/app/models.py†L120-L220】

### 1.2 Comments and activity
- Card detail drawers let users add, edit, or delete comments through `WorkspaceStore` helpers (`addComment`, `updateComment`, `removeComment`), which push optimistic placeholders and call the comment API client.【F:frontend/src/app/core/state/workspace-store.ts†L1241-L1319】【F:frontend/src/app/core/state/workspace-store.ts†L1410-L1447】【F:frontend/src/app/core/api/comments-api.service.ts†L1-L46】
- The `/comments` router ensures the card and subtask belong to the current user, writes the `Comment` ORM entity, and captures audit events before committing. Subsequent reads join author metadata for display.【F:backend/app/routers/comments.py†L35-L174】【F:backend/app/models.py†L273-L297】

### 1.3 Board preferences and filtering
- Toolbar interactions update grouping and quick filters inside `WorkspaceStore`, which also persists the preferences for the active user so subsequent sessions reload the same view.【F:frontend/src/app/features/board/page.ts†L325-L368】【F:frontend/src/app/core/state/workspace-store.ts†L1070-L1126】【F:frontend/src/app/core/state/workspace-store.ts†L2529-L2563】
- Persisted board layouts and notification settings are backed by the `/board-layouts` router and the `UserPreference` table when the client syncs server-side preferences (e.g., during bootstrap or explicit updates).【F:backend/app/routers/preferences.py†L12-L35】【F:backend/app/models.py†L273-L282】

## 2. Analyzer and Analytics Driven Workflows

### 2.1 Analyzer proposals → cards
- The Analyze page gathers free-form notes, feeds them through `AnalysisGateway`, and renders synthesized proposals while tracking submission state and feedback banners.【F:frontend/src/app/features/analyze/page.ts†L1-L188】【F:frontend/src/app/core/api/analysis-gateway.ts†L1-L176】
- Publishing an accepted proposal invokes `WorkspaceStore.createCardFromSuggestion`, which normalizes the request, calls `CardsApiService.createCard`, and injects the created card into the signal store before the backend responds.【F:frontend/src/app/core/state/workspace-store.ts†L1613-L1678】 The backend runs the same quota, scoring, and persistence flow described in §1.1, storing any AI-generated subtasks alongside the card.【F:backend/app/routers/cards.py†L327-L419】
- The `/analysis` endpoint enriches requests with the user profile, delegates to the ChatGPT client, and stores each submission and response in `analysis_sessions` before returning structured proposals.【F:backend/app/routers/analysis.py†L1-L54】【F:backend/app/models.py†L120-L162】

### 2.2 Analytics insights → improvement records
- The analytics dashboard reads derived board metrics and improvement fixtures while offering a “convert to card” action for suggested improvements.【F:frontend/src/app/features/analytics/page.ts†L46-L144】 When a suggestion is promoted, `ContinuousImprovementStore.convertSuggestedAction` routes the payload to `WorkspaceStore.createCardFromSuggestion` and annotates the originating suggestion and initiative progress locally.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L155-L218】
- On the backend, suggested actions, analyses, and initiatives are persisted through the analytics routers. `SuggestedAction.created_card_id` links each promoted action back to its generated card for traceability in the database.【F:backend/app/models.py†L364-L460】

## 3. Status Reporting and AI Summaries

- The status report assistant collects sectioned content, submits it via `StatusReportsGateway`, immediately calls `/status-reports/{id}/submit`, and shows completion or error feedback in the UI.【F:frontend/src/app/features/reports/reports-page.component.ts†L1-L109】【F:frontend/src/app/core/api/status-reports-gateway.ts†L1-L45】
- `StatusReportService` normalizes sections, writes the `StatusReport` model (including card links and event history), and, upon submission, triggers the ChatGPT analyzer. Results update analysis timestamps, capture failures, and return generated proposals that can later become cards.【F:backend/app/services/status_reports.py†L36-L200】【F:backend/app/models.py†L465-L504】

## 4. Workspace Configuration (Statuses, Labels, Templates)

- The settings page drives additions and edits for statuses, labels, and analyzer templates through `WorkspaceStore` methods, which forward to `WorkspaceConfigApiService` and refresh cached configuration after each mutation.【F:frontend/src/app/features/settings/page.ts†L20-L105】【F:frontend/src/app/core/state/workspace-store.ts†L1803-L1894】【F:frontend/src/app/core/api/workspace-config-api.service.ts†L1-L88】
- The backend routers persist these assets in their respective tables (`Status`, `Label`, `WorkspaceTemplate`), enforce ownership, deduplicate template label assignments, and null out references when a status or label is removed.【F:backend/app/routers/statuses.py†L19-L89】【F:backend/app/routers/labels.py†L13-L61】【F:backend/app/routers/workspace_templates.py†L14-L118】【F:backend/app/models.py†L248-L310】【F:backend/app/models.py†L560-L600】

## 5. Competency Evaluations (User Profile)

- The profile evaluations page loads personal history, quota status, and allows the user to run another self-assessment through `CompetencyApiService`, updating the timeline and quota display reactively.【F:frontend/src/app/features/profile/evaluations/page.ts†L1-L205】【F:frontend/src/app/core/api/competency-api.service.ts†L1-L34】
- `/users/me/evaluations` and related quota endpoints enforce per-day limits, queue a `CompetencyEvaluationJob`, and delegate scoring to the evaluator service, which persists `CompetencyEvaluation` and child items with AI rationale and recommended actions.【F:backend/app/routers/competency_evaluations.py†L53-L129】【F:backend/app/models.py†L632-L699】

## 6. Admin Console (Governance and Quotas)

- The admin dashboard surfaces competency management, evaluation logs, user roles, API credentials, and quota defaults by calling `AdminApiService` methods from tab-specific handlers (e.g., `createCompetency`, `triggerEvaluation`, `updateUser`).【F:frontend/src/app/features/admin/page.ts†L1-L200】【F:frontend/src/app/core/api/admin-api.service.ts†L1-L74】
- FastAPI routers under `/admin` persist changes to `Competency`, `CompetencyCriterion`, and evaluation jobs, manage user role flags and quota overrides, and encrypt provider secrets before storing them in `ApiCredential` along with configurable quota defaults.【F:backend/app/routers/competencies.py†L17-L145】【F:backend/app/routers/admin_users.py†L14-L74】【F:backend/app/routers/admin_settings.py†L12-L86】【F:backend/app/models.py†L586-L700】【F:backend/app/models.py†L727-L777】

## 7. Supporting Data Structures

- Status reports, appeals, analytics, and board artefacts share the same `User` ownership model, ensuring cascading deletes and quota bookkeeping through `DailyCardQuota`, `DailyEvaluationQuota`, and `QuotaDefaults` records that guard automated flows.【F:backend/app/models.py†L120-L190】【F:backend/app/models.py†L727-L744】 These relationships provide the backbone for consistent auditing across all features described above.
