# Architecture Overview

## System Context

Verbalize Yourself pairs an Angular single-page application with a FastAPI backend. The SPA issues JSON requests for workspace operations, analytics, reporting, competency evaluations, and administration. The backend orchestrates persistence, AI integrations, quota enforcement, and encrypted secret storage.

```mermaid
flowchart LR
    User((Workspace users)) -->|Browser| Frontend[Angular SPA]
    Frontend -->|REST / JSON| Backend[FastAPI application]
    Backend -->|SQLAlchemy ORM| Database[(SQLite or PostgreSQL)]
    Backend -->|Responses API| Google AI[(Gemini)]
    Backend <-->|Tokens & profile| Frontend
    Backend -->|Reports & analytics| AdminTools[(Admin & analytics UIs)]
```

## Guiding Priorities

1. **Security first** – enforce role-based access, encrypt secrets, and gate API credentials at the backend even when the SPA applies optimistic UI flows.
2. **Consistent UX** – pair optimistic UI updates with idempotent APIs so retries or failures never leave the board or reports in an indeterminate state.
3. **Extensibility** – keep domain logic modular: new AI-powered features or governance rules should land inside bounded contexts without cross-cutting rewrites.
4. **Observability** – capture token usage, status-report events, and analyzer adoption signals to validate AI behaviour and reinforce governance workflows.

## Bounded Contexts

The product is modelled around five bounded contexts shared by the frontend and backend:

- **Workspace operations** – board management, subtasks, comments, and workspace configuration.
- **Analysis intake** – AI-assisted proposal generation, eligibility filtering, and publication to the board.
- **Status reporting** – drafting, submission, AI analysis, retries, and audit trails for daily/weekly reports.
- **Competency evaluations** – quota-governed skill assessments and profile-aligned prompts.
- **Administration & governance** – quotas, credentials, policy settings, and compliance reporting.

## Frontend Architecture

### Route map

| Path | Module | Description |
| --- | --- | --- |
| `/login` | `features/auth/login/page` | Email and password sign-in guarded by `authGuard` redirects. |
| `/board` | `features/board/page` | Kanban workspace with drag-and-drop cards, subtasks, filters, and quick actions. |
| `/input` | `features/analyze/page` | AI intake form that submits notes to `/analysis`, filters proposals, and lets operators publish cards. |
| `/reports` | `features/reports/reports-page.component` | Shift report assistant with AI drafting, audit log, and card publishing. |
| `/analytics` | `features/analytics/feature` | Workspace dashboards plus AI-generated immunity maps exported in Mermaid format. |
| `/profile/evaluations` | `features/profile/evaluations/page` | User-facing competency evaluations, quota status, and historical feedback. |
| `/settings` | `features/settings/page` | Workspace configuration for statuses, labels, and analyzer templates. |
| `/admin` | `features/admin/page` | Admin console for API credentials, quotas, governance data, and user role management. |

Standalone components are lazy loaded through `app.routes.ts` to minimise bootstrap size. Guards in `core/auth` enforce authentication and administrator access where required.

### State and data flow

- **WorkspaceStore (`core/state/workspace-store.ts`)** caches cards, subtasks, comments, workspace settings, filters, and templates. It persists selections to local storage per user while synchronising authoritative data from the backend through `WorkspaceConfigApiService` and `CardsApiService` calls. Optimistic updates roll back on failure and reconcile card responses from the API.
- **Immunity map generation** lives in the analytics feature UI and calls `/analysis/immunity-map` via the `ImmunityMapGateway` API client.
- **AuthService (`core/auth/auth.service.ts`)** stores the active session token in memory and browser storage, exposes the active user profile, and coordinates guard redirects.
- **Signal forms (`shared/forms/signal-forms.ts`)** provide type-safe abstractions for forms backed by Angular signals, reducing template boilerplate for settings and report workflows.

### API layer

HTTP concerns are centralised under `core/api`:

- `api.config.ts` builds base URLs and injects credentials into requests.
- `cards-api.service.ts` exposes card CRUD, nested `/subtasks` management, and the `/cards/{id}/similar` helper used by the analyzer.
- `comments-api.service.ts` wires comment CRUD endpoints to the board drawer.
- `workspace-config-api.service.ts` wraps `/statuses`, `/labels`, and `/workspace/templates` plus related request/response contracts.
- `analysis-gateway.ts` posts analyzer submissions to `/analysis`, maps persisted responses into workspace proposals, and surfaces them to the UI.
- `status-reports-gateway.ts`, `admin-api.service.ts`, and `competency-api.service.ts` cover the remaining feature areas.
- `loading.interceptor.ts` and `error.interceptor.ts` wrap HTTP traffic so loading indicators and the global error banner stay in sync via `HttpErrorNotifierService`.

### UI and UX

- Tailwind-inspired design tokens live in `frontend/src/styles/pages`, with per-feature SCSS providing layout and component styling.
- Shared UI primitives (drawers, buttons, empty states) live under `shared/ui` and are reused across features.
- Accessibility is reinforced via ARIA attributes and keyboard affordances, particularly in board actions and admin tables.
- Localization strings currently focus on Japanese copy for settings and admin flows while keeping the component structure language-agnostic.

## Backend Architecture

### Application lifecycle

`app.main` loads environment settings, registers CORS, executes startup migrations (`migrations.run_startup_migrations`), and then calls `Base.metadata.create_all` to ensure schema alignment. Routers from `app/routers` are mounted with descriptive prefixes, and `/health` exposes a simple readiness probe.

### Router surface

- **Authentication and profile**: `/auth` issues session tokens, hashes them in the database, and rotates credentials on login. `/profile` returns enriched user metadata. `/board-layouts` (preferences router) persists per-user column widths, filters, and layout choices. `/preferences` is complemented by `/filters` for saved board queries.
- **Workspace operations**: `/cards` handles card CRUD, drag-and-drop updates, nested `/subtasks`, and `/cards/{id}/similar`. `/comments` and `/activity-log` manage discussions and manual activity entries. `/labels`, `/statuses`, `/error-categories`, and `/workspace/templates` provide configuration endpoints used by the settings UX.
- **Analysis and automation**: `/analysis` forwards intake requests to `GeminiClient` and returns JSON-schema validated proposals. `/analysis/immunity-map` turns reflective inputs into Mermaid-formatted immunity maps. `/status-reports` orchestrates shift report CRUD plus AI processing through `StatusReportService`. `/reports` manages report templates and generated narratives and formats analytics context, while `/appeals` produces Japanese appeal narratives for external escalation workflows.
- **Analytics and improvement**: `/analytics` serves snapshot records for dashboards. `/initiatives` coordinates improvement initiatives linked to analytics snapshots.
- **Competency management**: `/admin/competencies` allows administrators to manage competency rubrics and trigger evaluations. `/admin/evaluations` and `/users/me/evaluations` expose evaluation history and quotas for administrators and end users respectively, while `/users/me/evaluations/batch` runs batch requests that consume one daily quota per call.
- **Administration**: `/admin/users` manages user roles, quota overrides, and invites. `/admin/api-credentials`, `/admin/quotas/defaults`, and `/admin/quotas/{user_id}` (exposed through `admin_settings.py`) provide credential storage and quota configuration guarded by `require_admin`.

### Services and utilities

- **Gemini integration (`services/gemini.py`)** validates requests against strict JSON schemas, encrypts credentials, records token usage, and exposes helpers for analysis, status report enrichment, and appeal generation. Missing API keys raise `GeminiConfigurationError` at dependency resolution time.
- **Status report orchestration (`services/status_reports.py`)** normalises section content, records lifecycle events, invokes Gemini for analysis, and caps generated card counts. It returns structured `StatusReportProcessResult` payloads that combine report details with AI proposals.
- **Appeals service (`services/appeals.py`)** crafts appeal prompts, deduplicates narrative sections, and stores generated appeals with source tracking.
- **Competency evaluator (`services/competency_evaluator.py`)** builds chat prompts for evaluations, respects daily limits via `utils.quotas`, and persists evaluation jobs with summary statistics.
- **Profile service (`services/profile.py`)** consolidates user metadata for prompt enrichment and profile responses.
- **Utility modules** handle quota calculations (`utils.quotas`), encrypted secrets (`utils.secrets` and `utils.crypto`), repository helpers (`utils.repository`), and manual activity logging (`utils.activity`).

### Data model highlights

SQLAlchemy models in `app/models.py` capture:

- **Identity**: `User`, `SessionToken`, `UserPreference`, `UserQuotaOverride`, and `ApiCredential` (encrypted secret storage with hints).
- **Workspace**: `Card`, `Subtask`, `CardComment`, `CardActivity`, `Label`, `Status`, `ErrorCategory`, `WorkspaceTemplate`, and the `card_labels` association table.
- **Analytics and improvement**: `AnalyticsSnapshot`, `ImprovementInitiative`, and `InitiativeProgressLog`.
- **Reporting**: `StatusReport`, `StatusReportEvent`, `GeneratedReport`, and `ReportTemplate`.
- **Competencies**: `Competency`, `CompetencyPrompt`, `CompetencyEvaluation`, and `EvaluationJob`.
Timestamp mixins enforce UTC-aware audit fields, and helper methods normalise IDs through UUID4 generation.

### Security and quota enforcement

- Session tokens are hashed with per-token salt before storage and rotated on re-authentication.
- Dependency helpers (`auth.get_current_user`, `utils.dependencies.require_admin`) guard privileged routes.
- Quota helpers (`utils.quotas`) merge global defaults and per-user overrides for card creation and competency evaluations. Reserved capacity is tracked through usage tables to prevent abuse.
- Secrets use AES-GCM via `utils.secrets.get_secret_cipher`, with hints allowing administrators to identify stored providers without revealing raw keys.

### Startup migrations

`migrations.py` seeds mandatory rows, backfills new columns (for example, `users.is_admin`, comment links, report metadata), and ensures admin promotion for the first registered user. On each startup the migrations run idempotently before `Base.metadata.create_all`, allowing deployments to SQLite or PostgreSQL without manual migrations.

## Data flow highlights

### Board bootstrap and workspace configuration

1. `WorkspaceStore` loads cached settings from local storage based on the active user ID.
2. Effects trigger `cardsApi.listCards()` and `workspaceConfigApi.list*()` calls. Responses reconcile local caches, update status/label catalogs, and normalise templates.
3. Board views render computed selectors for filtered card IDs, quick filters, and summary widgets. Mutations (drag-and-drop, subtask edits, comment changes) optimistically update signals and persist through the relevant API service.

### Analyzer and report automation

1. The analyzer page collects trimmed notes and optional objectives, then posts an `AnalysisRequest` with profile metadata to `/analysis`.
2. `GeminiClient` builds the system prompt, validates the JSON response against `_BASE_RESPONSE_SCHEMA`, and returns cleaned proposals with fallback content when the model produces unusable items.
3. Accepted proposals call `WorkspaceStore.publishProposals`, which maps them into `CardCreateRequest` payloads and persists them via `/cards`.
4. Status reports follow a similar path: editors submit sections to `/status-reports`, `StatusReportService` stores a draft, invokes Gemini for insights, records events, and returns proposals that the frontend can publish or discard.

### Analytics and improvement loop

1. Admins import analytics snapshots through `/analytics`.
2. Users generate immunity maps through `/analysis/immunity-map` and export Mermaid diagrams to discuss current constraints and deep drivers.
3. Improvement initiatives track progress logs and can be linked to cards for execution and reporting.

### Competency evaluation lifecycle

1. Admins define competencies and prompts through `/admin/competencies`.
2. Users request evaluations via `/users/me/evaluations` or `/users/me/evaluations/batch`. Quota helpers enforce daily limits per request (batch counts as 1), and `CompetencyEvaluator` runs Gemini prompts, storing results and token usage.
3. Administrators review evaluations via `/admin/evaluations`, while users check their own history and quotas in the profile feature.

### Administrative operations

- `/admin/api-credentials/{provider}` encrypts and stores secrets using the configured `SECRET_ENCRYPTION_KEY`; set a sufficiently long random value or the admin console returns HTTP 503 when credentials are accessed.
- `/admin/quotas/defaults` and `/admin/quotas/{user_id}` expose the quota override pipeline consumed by the admin console.
- User management endpoints surface aggregated quota data, recent activity, and role settings to support governance flows.

Docs under `docs/features/` provide deeper functional requirements for each feature area; consult them alongside this architecture summary when planning enhancements.

## Design Principles

- **Domain-driven structure** – each bounded context owns its routers, services, schemas, and UI features so changes stay localized.
- **API-first development** – Pydantic schemas and generated OpenAPI contracts drive cross-team alignment; schema updates precede implementation.
- **Explicit side effects** – isolate external calls (Gemini, email, encryption) inside services to keep routers thin and tests focused.

## Development Workflow

1. **Plan & design** – facilitators and architects outline requirements, surface dependencies, and document acceptance criteria.
2. **Implementation** – contributors follow coding standards, keep stores/services cohesive, and update documentation alongside code.
3. **Quality gates** – static analysis, unit tests, dependency audits, and AI-safety checks must pass locally before review.
4. **Multistage review** – design, code, and release reviews ensure compliance with security, UX, and governance expectations before PRs merge.

## Operations & Security

- Secrets are encrypted with AES-GCM helpers driven by `SECRET_ENCRYPTION_KEY`; admin APIs fail fast (HTTP 503) when the key is absent.
- Router dependencies such as `require_admin` enforce role checks server-side; the SPA mirrors roles in guards to keep UI flows aligned.
- Audit logging records status-report events, AI proposal adoption, and quota changes so support teams can trace decisions.
- Quota enforcement centralizes daily and per-user limits, backing off API usage when AI workloads spike.

## Documentation & Knowledge Sharing

- Keep `docs/` synchronized with feature work: update requirements, playbooks, and indices when flows change.
- Capture architectural decisions in spec updates or repo issues so onboarding contributors understand prior rationale.
- Co-locate recipes (`*.recipe.md`) with source files to document complex components or services without bloating the primary docs.
