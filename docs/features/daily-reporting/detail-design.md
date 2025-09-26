# Daily Reporting Detailed Design

## API Surface
- `POST /daily-reports` — Creates a draft report for the authenticated user, normalizes sections/tags, records a `DRAFT_CREATED` event, and returns the persisted payload. Validation ensures at least one section body is present.【F:backend/app/routers/daily_reports.py†L16-L37】【F:backend/app/services/daily_reports.py†L31-L82】
- `GET /daily-reports` — Lists reports owned by the user with optional status filtering, eagerly loading linked cards to surface counts in list responses.【F:backend/app/routers/daily_reports.py†L30-L53】【F:backend/app/services/daily_reports.py†L96-L133】
- `GET /daily-reports/{report_id}` — Retrieves a single report with detailed events, card summaries, and pending proposals when `include_details` is requested.【F:backend/app/routers/daily_reports.py†L39-L54】【F:backend/app/services/daily_reports.py†L96-L190】
- `PUT /daily-reports/{report_id}` — Updates draft or failed reports by re-normalizing sections/tags and appending an `UPDATED` event. Requests against other statuses return a 400 error.【F:backend/app/routers/daily_reports.py†L55-L73】【F:backend/app/services/daily_reports.py†L62-L90】
- `POST /daily-reports/{report_id}/submit` — Transitions the report into `PROCESSING`, records submission/analysis-start events, and orchestrates ChatGPT analysis. Returns the latest detail snapshot and pending proposals without deleting the record yet.【F:backend/app/routers/daily_reports.py†L74-L93】【F:backend/app/services/daily_reports.py†L138-L177】
- `POST /daily-reports/{report_id}/retry` — Re-runs analysis exclusively for failed reports. The service enforces status validation, reuses the same submission pipeline, and returns the refreshed detail payload.【F:backend/app/routers/daily_reports.py†L94-L109】【F:backend/app/services/daily_reports.py†L138-L205】

## Event Logging & Processing Metadata
- Every state transition records a `DailyReportEvent` instance, providing an ordered audit log returned via detail responses. Events capture submission, analysis start, proposal persistence, completion, and failures with contextual payloads.【F:backend/app/services/daily_reports.py†L46-L213】
- Processing metadata tracks pending proposals, created card IDs, confidence scores, and the last error. Helpers ensure the JSON column is always a dictionary and merges incremental updates safely.【F:backend/app/services/daily_reports.py†L182-L217】
- Events are sorted by normalized timestamps before serialization to ensure deterministic timelines even when timezone metadata is missing.【F:backend/app/services/daily_reports.py†L200-L238】

## ChatGPT Integration
- The `DailyReportService` accepts an optional `ChatGPTClient`. Submission calls compose a prompt from normalized sections, invoke the `analyze` method with a capped number of proposals, and capture the `model` identifier returned by ChatGPT.【F:backend/app/services/daily_reports.py†L118-L177】
- Errors from ChatGPT raise a `ChatGPTError`, leading to a failed status, failure reason, and captured error message. Successful analyses store proposals, log completion events, and mark the report `COMPLETED` before the database row is deleted and the detail payload returned.【F:backend/app/services/daily_reports.py†L150-L213】

## Data Model Usage
- Reports persist normalized sections as JSON content and tags as deduplicated lists, allowing idempotent updates via the update endpoint.【F:backend/app/services/daily_reports.py†L62-L117】
- Linked cards, subtasks, and card statuses are preloaded when returning details so UI consumers receive complete summaries without additional queries.【F:backend/app/services/daily_reports.py†L108-L190】
- Processed proposals remain in `processing_meta` until cards are created elsewhere. Destroyed reports still return detail snapshots constructed before deletion, enabling clients to render analysis results for ephemeral runs.【F:backend/app/services/daily_reports.py†L178-L213】

## UI Workflow
- The Angular `ReportAssistantPageComponent` renders a standalone page with a dynamic sections form, tag entry, and submission button. It blocks duplicate submissions while awaiting backend responses.【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L75】
- On submit, the component chains report creation and submission, stores the returned detail, shows a localized success message, and resets the form back to a single blank section.【F:frontend/src/app/features/reports/reports-page.component.ts†L63-L108】
- Errors from the backend or network are parsed into user-friendly Japanese strings, allowing members to correct validation issues or retry later.【F:frontend/src/app/features/reports/reports-page.component.ts†L95-L147】
