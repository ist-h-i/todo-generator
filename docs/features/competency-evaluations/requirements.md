# Competency Evaluation Experience Requirements

## Document Control

| Item | Detail |
| --- | --- |
| Version | 1.0 |
| Last Updated | 2024-06-08 |
| Owner | Product & AI Enablement |
| Status | Draft – validated against current frontend and API behaviour |

## Objectives

- Give members a transparent view into AI-authored competency evaluations, including scores, rationales, and recommended next actions.
- Allow members to self-trigger a batch evaluation request (multiple competencies per request) while enforcing daily quota limits and surfacing remaining usage.
- Support manual exports and historical review so members can reuse insights outside the application.
- Maintain operational guardrails so quota overages, invalid periods, or missing competencies return explicit error feedback.

## Personas & Stakeholders

- **Member (primary user)** – Authenticated user accessing `/profile/evaluations` to review history, trigger evaluations, and download results.【F:frontend/src/app/features/profile/evaluations/page.ts†L38-L210】
- **Administrator (secondary)** – Uses admin endpoints to audit historical evaluations and tune quota defaults or overrides.【F:backend/app/routers/competency_evaluations.py†L43-L93】【F:backend/app/utils/quotas.py†L1-L108】
- **AI Operations** – Monitors evaluation job execution and handles quota escalations or failures surfaced via job records.【F:backend/app/routers/competency_evaluations.py†L110-L185】

## User Stories

1. **View history** – As a member, I can see up to 12 recent competency evaluations, including triggered source, AI model, and rationale, so I can understand trends.【F:frontend/src/app/features/profile/evaluations/page.ts†L60-L151】【F:frontend/src/app/features/profile/evaluations/page.html†L85-L240】
2. **Monitor quota** – As a member, I can see today’s evaluation request limit, remaining runs, and usage state so I know when I can safely trigger another evaluation request (batch counts as 1).【F:frontend/src/app/features/profile/evaluations/page.ts†L44-L113】【F:frontend/src/app/features/profile/evaluations/page.html†L12-L54】
3. **Run evaluation** – As a member, I can trigger a manual evaluation request for selected competencies, and I receive immediate feedback or errors if quotas or validation fail.【F:frontend/src/app/features/profile/evaluations/page.ts†L118-L209】【F:backend/app/routers/competency_evaluations.py†L110-L185】
4. **Export results** – As a member, I can download the latest evaluation as JSON with a sanitized filename for external sharing.【F:frontend/src/app/features/profile/evaluations/page.ts†L210-L275】
5. **Admin audit** – As an administrator, I can filter evaluations by user, competency, or time window to investigate performance or resolve disputes.【F:backend/app/routers/competency_evaluations.py†L43-L78】

## Functional Requirements

### Evaluation Retrieval

- The system must fetch the latest evaluations for the authenticated member using `/users/me/evaluations` with a configurable limit capped at 50 (UI defaults to 12).【F:frontend/src/app/features/profile/evaluations/page.ts†L225-L258】【F:backend/app/routers/competency_evaluations.py†L80-L109】
- Responses include competency metadata, score values, AI model labels, rationale text, and itemized attitude/behavior actions for display and export.【F:frontend/src/app/features/profile/evaluations/page.html†L99-L240】

### Quota Awareness & Enforcement

- Daily evaluation limits default to 3 per member but respect per-user overrides stored in `UserQuotaOverride`. Limits apply per evaluation request (single or batch).【F:backend/app/utils/quotas.py†L1-L59】
- `/users/me/evaluations/quota` returns `daily_limit`, `used`, and `remaining` fields. When limits are unlimited (`<= 0`), the frontend must show “無制限.”【F:frontend/src/app/features/profile/evaluations/page.ts†L44-L114】【F:backend/app/routers/competency_evaluations.py†L92-L109】
- Batch requests to `/users/me/evaluations/batch` consume one quota per request even when multiple competencies are selected.【F:backend/app/routers/competency_evaluations.py†L502-L590】
- Triggering an evaluation request reserves quota via `reserve_daily_quota`. If the limit is exceeded, the API returns HTTP 429 with a descriptive message, and the UI refreshes quota state to reflect the lockout.【F:frontend/src/app/features/profile/evaluations/page.ts†L147-L209】【F:backend/app/routers/competency_evaluations.py†L134-L158】【F:backend/app/utils/quotas.py†L61-L117】

### Evaluation Triggers

- Single-run requests use the latest competency ID from history when present; batch runs send `competency_ids` and validate that every selected competency exists and is active, returning 404 if any are missing.【F:frontend/src/app/features/profile/evaluations/page.ts†L147-L209】【F:backend/app/routers/competency_evaluations.py†L23-L60】【F:backend/app/routers/competency_evaluations.py†L110-L133】
- Batch evaluations submit a single Gemini request for the selected competencies so AI usage aligns with the per-request quota model.【F:backend/app/routers/competency_evaluations.py†L540-L640】
- The backend normalizes evaluation periods, enforcing that the start date is not after the end date and defaulting to the current month when unspecified. Invalid ranges return HTTP 400.【F:backend/app/routers/competency_evaluations.py†L62-L89】
- Evaluation jobs record execution metadata (`triggered_by`, timestamps, job status) and pass through to the evaluator service so downstream monitoring can reconcile manual vs. automated runs.【F:backend/app/routers/competency_evaluations.py†L158-L185】

### Reporting & Exporting

- The UI must offer JSON export for the most recent evaluation, sanitizing filenames to remove reserved characters and ensuring a stable blob download sequence.【F:frontend/src/app/features/profile/evaluations/page.ts†L210-L275】
- Success and error feedback are shown inline (`app-alert`) with four-second auto-dismiss for positive states, enabling members to confirm actions without leaving the page.【F:frontend/src/app/features/profile/evaluations/page.ts†L44-L73】【F:frontend/src/app/features/profile/evaluations/page.html†L56-L84】
- Administrators can retrieve full evaluation lists for reporting via `/admin/evaluations`, with query filters on user, competency, and period boundaries.【F:backend/app/routers/competency_evaluations.py†L43-L78】

### Data Privacy & Security

- Evaluation history endpoints authenticate via `get_current_user`; admin routes require `require_admin` to prevent unauthorized access.【F:backend/app/routers/competency_evaluations.py†L43-L185】
- Manual trigger payloads accept optional `competency_id` and period fields only; backend guards against malformed IDs or ranges and returns structured errors surfaced in the UI.【F:frontend/src/app/features/profile/evaluations/page.ts†L168-L209】【F:backend/app/routers/competency_evaluations.py†L62-L158】
- Exported JSON reflects the API response without mutation. Frontend sanitization prevents file system injection via competency names or periods.【F:frontend/src/app/features/profile/evaluations/page.ts†L210-L275】

## Non-functional Requirements

- **Performance** – Evaluation list loads must complete within 2 seconds for up to 12 items; quota requests run in parallel and should not block evaluation rendering.【F:frontend/src/app/features/profile/evaluations/page.ts†L118-L258】
- **Reliability** – Backend evaluation job updates status transitions (`running` → `succeeded`/`failed`) even when exceptions occur, ensuring audits have accurate records.【F:backend/app/routers/competency_evaluations.py†L158-L185】
- **Usability** – Loading states, empty placeholders, and disabled actions communicate availability and quota states so members avoid redundant API calls.【F:frontend/src/app/features/profile/evaluations/page.html†L12-L200】
- **Internationalization** – Member-facing copy remains Japanese for continuity with existing UI text; backend error details should be mapped to localized messages where possible.【F:frontend/src/app/features/profile/evaluations/page.html†L12-L240】【F:frontend/src/app/features/profile/evaluations/page.ts†L118-L209】

## Success Metrics

- ≥ 90% of manual evaluation requests complete without quota or validation errors during a sprint (tracked via job records and HTTP 200 vs. 4xx/5xx rates).【F:backend/app/routers/competency_evaluations.py†L134-L185】
- ≥ 80% of members who trigger evaluations download or view the latest results within the same session (captured through export action telemetry and UI view events).【F:frontend/src/app/features/profile/evaluations/page.ts†L210-L275】
- 100% of quota override changes propagate to members on their next refresh, verified by comparing override timestamps to `/users/me/evaluations/quota` responses.【F:backend/app/utils/quotas.py†L1-L117】【F:backend/app/routers/competency_evaluations.py†L92-L133】
