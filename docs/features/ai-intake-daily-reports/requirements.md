# AI Intake & Daily Reports Requirements

## Document Control
- **Document ID:** FEAT-AI-INTAKE-DAILY-REPORTS
- **Version:** 1.0
- **Last Updated:** 2025-09-26
- **Author:** Product & AI Enablement
- **Status:** Draft for implementation alignment
- **Related Epics:** AI Task Intake, AI Daily Reporting

## Objectives
1. Convert free-form notes into actionable task proposals with minimal manual grooming.
2. Streamline daily or weekly report submissions so AI can summarize outcomes and surface follow-up work.
3. Preserve governance signals (status, events, proposal quotas) while providing transparent failure feedback.
4. Offer consistent UI and API behaviours so engineering, QA, and enablement teams can align on expected flows.

## Scope Boundaries
- **In Scope**
  - Analyzer page experience for capturing notes and generating card proposals.
  - Daily report CRUD, submission, and AI analysis lifecycle (including retries and event logs).
  - ChatGPT-powered proposal generation, filtering, and publication into the workspace store.
  - UI messaging for success, error, and empty states tied to analyzer and daily report flows.
- **Out of Scope**
  - Board management once proposals are published (handled by workspace features).
  - Analytics dashboards or downstream automations triggered by completed reports.
  - Non-AI fallback template generation (only surfaced as expectations when AI is unavailable).
  - Role-based access changes (current flows assume authenticated workspace members).

## Personas
- **Team Member (Primary):** submits notes, generates proposals, reviews and publishes AI suggestions.
- **Team Lead / Manager:** monitors daily/weekly reports, validates AI outcomes, ensures follow-up tasks land on the board.
- **Operations / QA Analyst:** verifies guardrails, monitors quota usage, and confirms failure handling paths.

## User Stories
| ID | As a | I want | So that |
| --- | --- | --- | --- |
| US-1 | Team Member | submit raw notes and let AI suggest objectives | I can turn messy thoughts into structured work quickly. |
| US-2 | Team Member | publish selected AI proposals to the workspace | I avoid duplicating tasks manually. |
| US-3 | Team Lead | review AI analysis of a daily report including events and cards | I understand what happened and what remains. |
| US-4 | Operations Analyst | enforce section and objective validation rules | AI receives quality inputs and failures are explicit. |
| US-5 | Team Member | retry failed daily reports once issues resolve | I can recover from transient AI errors without retyping content. |
| US-6 | QA Analyst | confirm quotas and failure notifications | AI usage stays predictable and testable. |

## Derived Behaviours
### Analyzer workflow
- Users compose notes, optionally override the goal, and submit the form; submission prevents default browser behaviour and only proceeds when inputs are valid (notes must exist, manual objectives required when auto mode is off). The form resets after successful publication to the workspace store.【F:frontend/src/app/features/analyze/page.ts†L23-L109】【F:frontend/src/app/features/analyze/page.html†L9-L157】
- Auto-objective mode previews a synthesized goal based on the first meaningful line of notes; manual mode toggles the textarea for custom objectives and hides the preview.【F:frontend/src/app/features/analyze/page.ts†L31-L86】【F:frontend/src/app/features/analyze/page.html†L31-L83】
- Analyzer results filter out proposals failing workspace eligibility checks before showing cards or enabling publication actions; empty states and loading indicators cover the full lifecycle.【F:frontend/src/app/features/analyze/page.ts†L37-L118】【F:frontend/src/app/features/analyze/page.html†L89-L198】
- Backend analysis endpoint authenticates the user, builds a profile, and proxies the request to ChatGPT with fallback to HTTP 502 on ChatGPT errors.【F:backend/app/routers/analysis.py†L1-L27】

### Daily report workflow
- Creation requires at least one section with body content; tags are normalized and duplicate-filtered. Draft creation records an event and stores sections in structured JSON.【F:backend/app/services/daily_reports.py†L28-L101】
- Angular form enforces a body for each section, blocks removal of the last section, supports dynamic section management, and prevents double submission while the request is pending.【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L91】【F:frontend/src/app/features/reports/reports-page.component.html†L15-L118】
- Upon submission the UI immediately surfaces errors or success messages, resets the form on success, and renders the latest detail payload including status badges, failure reasons, cards, proposals, sections, and event history.【F:frontend/src/app/features/reports/reports-page.component.ts†L47-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L120-L209】
- Backend submission transitions status to processing, records events, invokes ChatGPT, stores up to five proposals in processing metadata, and deletes the report after successful completion while returning the detail payload and proposals. Failures capture the error, mark the report as failed, and persist metadata for retries.【F:backend/app/services/daily_reports.py†L120-L240】
- Router endpoints gate updates to draft or failed statuses, enforce retry-only-from-failed, and prevent simultaneous submissions for processing reports.【F:backend/app/routers/daily_reports.py†L15-L107】

## Functional Requirements
### Analyzer
1. **Input validation:** Notes are mandatory. When auto-objective is disabled, the objective textarea must contain non-blank text before submission proceeds.【F:frontend/src/app/features/analyze/page.ts†L63-L108】
2. **Auto-objective synthesis:** Generate a recommended objective using the first non-empty note line, with a default fallback phrase when no content exists.【F:frontend/src/app/features/analyze/page.ts†L76-L96】
3. **Analysis request:** Post `AnalysisRequest` payloads to `/analysis`, including the resolved objective, and handle loading and error states in the UI.【F:frontend/src/app/features/analyze/page.ts†L30-L118】【F:backend/app/routers/analysis.py†L10-L27】
4. **Proposal filtering:** Display only proposals that satisfy workspace eligibility heuristics, exposing success, empty, and error states accordingly.【F:frontend/src/app/features/analyze/page.ts†L37-L118】【F:frontend/src/app/features/analyze/page.html†L137-L198】
5. **Publication:** Allow publishing individual or all eligible proposals to the workspace store and clear the form afterwards.【F:frontend/src/app/features/analyze/page.ts†L40-L71】【F:frontend/src/app/features/analyze/page.html†L149-L190】

### Daily Reports
1. **Draft management:** Support create, read, update for drafts/failed reports with section normalization, tag deduplication, and event logging.【F:backend/app/services/daily_reports.py†L28-L170】【F:backend/app/routers/daily_reports.py†L15-L64】
2. **Submission flow:** Transition reports to processing, call ChatGPT with composed prompts, and return detail payloads alongside stored proposals. Prevent concurrent submissions and destroy completed reports after delivering results.【F:backend/app/services/daily_reports.py†L120-L240】【F:backend/app/routers/daily_reports.py†L65-L107】
3. **Retry handling:** Allow retries only from the failed status while reusing stored content and metadata; maintain event history across attempts.【F:backend/app/routers/daily_reports.py†L88-L107】【F:backend/app/services/daily_reports.py†L120-L210】
4. **UI interactions:** Provide dynamic form sections, pending state locks, success/error alerts, and detail rendering for cards, proposals, and events.【F:frontend/src/app/features/reports/reports-page.component.ts†L22-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L24-L209】
5. **Data retention:** Because completed reports are deleted post-success, clients must rely on the returned detail payload to persist any needed summaries externally.【F:backend/app/services/daily_reports.py†L210-L240】

## Non-Functional Requirements
- **Performance:** ChatGPT responses should complete within service-level agreements (<30s) to avoid frontend timeouts; backend must surface 502 errors promptly when upstream fails.【F:backend/app/routers/analysis.py†L18-L27】【F:backend/app/services/daily_reports.py†L147-L207】
- **Security:** All endpoints require authenticated workspace users; no anonymous access is permitted.【F:backend/app/routers/analysis.py†L11-L21】【F:backend/app/routers/daily_reports.py†L17-L104】
- **Reliability:** Event logs and processing metadata must persist across restarts for failed reports so retries have full context.【F:backend/app/services/daily_reports.py†L120-L210】
- **Usability:** UI should provide accessible aria labels, focus-ring classes, and descriptive empty states for both analyzer and report detail views.【F:frontend/src/app/features/analyze/page.html†L9-L198】【F:frontend/src/app/features/reports/reports-page.component.html†L9-L209】

## Validation, Quotas, and Guardrails
- **Form validation:** Analyzer notes and manual objectives enforce non-empty text; daily report sections require body content and keep at least one section available. Pending submissions block duplicate requests.【F:frontend/src/app/features/analyze/page.ts†L63-L109】【F:frontend/src/app/features/reports/reports-page.component.ts†L31-L91】
- **Backend validation:** Report creation/update rejects payloads without meaningful sections (HTTP 422) and ensures retries or updates occur only in permitted states.【F:backend/app/services/daily_reports.py†L41-L115】【F:backend/app/routers/daily_reports.py†L39-L107】
- **Quota enforcement:** `_MAX_GENERATED_CARDS` restricts AI proposal storage to five items per report; processing metadata records pending proposals and created card IDs for auditing.【F:backend/app/services/daily_reports.py†L12-L210】
- **AI fallback expectations:** ChatGPT errors mark reports as failed, capture `failure_reason`, leave drafts intact, and surface error alerts in the UI. Analyzer endpoint returns HTTP 502 on upstream failure, triggering UI error messaging.【F:backend/app/routers/analysis.py†L18-L27】【F:backend/app/services/daily_reports.py†L168-L206】【F:frontend/src/app/features/reports/reports-page.component.ts†L64-L109】
- **Notification flows:** Success and error states use alert components; daily report detail exposes failure reasons and status badges, while analyzer surfaces loading, success, and empty states with clear messaging.【F:frontend/src/app/features/analyze/page.html†L101-L198】【F:frontend/src/app/features/reports/reports-page.component.html†L55-L209】
- **Reporting outcomes:** Detail payloads include sections, cards, pending proposals, events, and processing metadata; frontend displays each grouping, and success toast guides users to review AI-generated tasks.【F:frontend/src/app/features/reports/reports-page.component.ts†L51-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L120-L209】【F:backend/app/services/daily_reports.py†L180-L240】

## Success Metrics
### Analyzer
- ≥80% of submissions result in at least one eligible proposal reaching the workspace store (track via proposal filtering and publish actions).
- Form validation prevents empty-note submissions in 100% of tracked sessions.
- UI error alerts surface within one second when backend returns non-2xx responses.

### Daily Reports
- 95% of successful submissions deliver proposal payloads within the five-card quota and return detail data for downstream storage.
- 100% of failed ChatGPT calls record a failure event and expose `failure_reason` to the client.
- Retry requests from failed reports succeed (status becomes `completed`) at least 70% of the time once upstream availability is restored.
