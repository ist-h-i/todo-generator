# Daily Reporting Requirements

## Background
- Members compose multi-section daily or weekly reflections that must be normalized into structured content before AI analysis runs. The backend service rejects reports without at least one populated section and cleans titles/tags prior to storage, ensuring the report content remains coherent for downstream processing.【F:backend/app/services/daily_reports.py†L31-L96】
- Reports are owned by authenticated users and stored with status tracking (draft, processing, failed, completed). Subsequent submissions reuse persisted content and trigger additional processing events when needed.【F:backend/app/routers/daily_reports.py†L16-L109】【F:backend/app/services/daily_reports.py†L104-L205】

## Objectives
- Allow contributors to draft structured reports, submit them for AI-assisted analysis, and immediately review generated task proposals without manual intervention.【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L96】
- Provide a repeatable workflow that records lifecycle events, captures ChatGPT analysis outcomes, and gracefully handles transient failures with retry support.【F:backend/app/routers/daily_reports.py†L55-L109】【F:backend/app/services/daily_reports.py†L138-L225】

## Scope
- **In scope:**
  - FastAPI endpoints under `/daily-reports` for creating, listing, retrieving, updating, submitting, and retrying report analysis.【F:backend/app/routers/daily_reports.py†L16-L109】
  - Server-side normalization of report sections, tags, and processing metadata to safeguard consistency before analysis requests are dispatched.【F:backend/app/services/daily_reports.py†L31-L187】
  - Angular form experience for composing sections, submitting reports, surfacing success or error states, and presenting analysis details once available.【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L128】
- **Out of scope:**
  - Automated card creation from analysis proposals (handled elsewhere after the analysis completes).
  - Administrative analytics or governance controls beyond the report lifecycle described above.

## User Stories
- As a team member, I can capture multiple sections with optional titles so that only meaningful content is forwarded for AI analysis.【F:frontend/src/app/features/reports/reports-page.component.ts†L31-L83】【F:backend/app/services/daily_reports.py†L31-L90】
- As a team member, I receive immediate feedback when my report submission succeeds or fails, enabling me to retry if necessary.【F:frontend/src/app/features/reports/reports-page.component.ts†L63-L117】【F:backend/app/routers/daily_reports.py†L74-L109】
- As a team member, I can view prior reports filtered by status to monitor processing progress and historical outcomes.【F:backend/app/routers/daily_reports.py†L30-L53】
- As a team member, I can revise draft or failed reports before resubmitting them to address validation or analysis feedback.【F:backend/app/routers/daily_reports.py†L55-L73】

## Acceptance Criteria
- Report creation must require at least one non-empty section and persist normalized titles, tags, and auto-ticket preferences.【F:backend/app/services/daily_reports.py†L31-L90】
- Submissions must transition reports into a processing state, log submission and analysis-start events, and attempt ChatGPT analysis with a configurable card cap.【F:backend/app/services/daily_reports.py†L138-L177】
- On successful analysis, reports are marked completed, proposal metadata is stored, lifecycle events are appended, and the persisted row is removed after returning the detail payload to the client.【F:backend/app/services/daily_reports.py†L178-L213】
- On analysis failure, the failure reason is recorded, report status becomes failed, processing metadata captures the error, and a retry endpoint is exposed for failed reports only.【F:backend/app/routers/daily_reports.py†L94-L109】【F:backend/app/services/daily_reports.py†L154-L170】
- The frontend must block duplicate submissions while a request is pending, reset the form after success, and surface localized error messaging when the backend returns validation or transport issues.【F:frontend/src/app/features/reports/reports-page.component.ts†L41-L125】
