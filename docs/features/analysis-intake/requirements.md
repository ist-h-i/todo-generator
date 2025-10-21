# Analyzer & Status Report Requirements

## Document Control

| Field | Value |
| --- | --- |
| Version | 1.2 |
| Author | Product Design Team |
| Last Updated | 2025-10-20 |
| Status | Draft |

## 1. Goals & Background

The analyzer flow converts free-form workspace notes into structured task proposals so facilitators can triage AI suggestions alongside existing cards. The `/analysis` endpoint enriches each request with the signed-in user's profile before delegating to the Gemini client, letting prompts reflect roles, experience, and bios while keeping authentication centralised.【F:backend/app/routers/analysis.py†L12-L27】【F:backend/app/services/gemini.py†L219-L325】When Gemini responses arrive, the backend validates them against a strict JSON schema, normalises malformed entries, and inserts fallback cards whenever no usable output is returned, guaranteeing that the UI always receives actionable proposals.【F:backend/app/services/gemini.py†L46-L167】【F:backend/app/services/gemini.py†L387-L433】On the frontend, the analyzer page gathers notes, synthesises objectives, and filters proposals through the workspace store so only eligible cards can be published back to the board.【F:frontend/src/app/features/analyze/page.ts†L24-L138】

Status reporting extends the same governance expectations to shift summaries. Users compose sectioned reports, submit them for AI analysis, and receive proposals plus detail payloads that capture sections, cards, events, and failure metadata. Drafts, retries, and quotas are orchestrated by the backend service so UI flows stay predictable even when Gemini fails.【F:backend/app/services/status_reports.py†L28-L240】【F:backend/app/routers/status_reports.py†L15-L107】【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L15-L209】

## 2. Scope Boundaries

- **In scope**
  - Analyzer page experience for capturing notes, generating card proposals, and publishing them to the workspace store.
  - Status report draft CRUD, submission, retry, and Gemini-driven analysis life cycle, including event logging.
  - Gemini-powered proposal generation, filtering, and quota enforcement shared by analyzer and status reports.
  - UI messaging across loading, success, empty, and failure states for both analyzer and report detail views.

- **Out of scope**
  - Workspace board management after proposals are published (handled by workspace features).
  - Analytics dashboards or downstream automations triggered by completed reports.
  - Non-AI template generation (only surfaced as expectations when AI is unavailable).
  - Role-based access model changes (flows assume authenticated workspace members with existing roles).

## 3. Personas

| Persona | Goals | Key Needs |
| --- | --- | --- |
| Sprint Facilitator | Turn retrospective notes into prioritised actions without retyping context | Rapid intake with eligibility filtering and one-click publishing into the workspace board.【F:frontend/src/app/features/analyze/page.ts†L36-L87】 |
| Product Engineer | Capture personal improvement goals that mirror profile context | Automatic objective synthesis reflecting the first meaningful note line and Gemini prompts aligned with profile metadata.【F:frontend/src/app/features/analyze/page.ts†L53-L132】【F:backend/app/services/gemini.py†L258-L325】 |
| Team Lead / Manager | Review AI analysis of submitted reports and ensure follow-up work lands on the board | Detail payloads that include cards, proposals, events, and failure reasons, plus clear status indicators in the UI.【F:frontend/src/app/features/reports/reports-page.component.ts†L47-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L120-L209】 |
| Operations Lead | Monitor AI adoption while ensuring misconfigurations fail gracefully | Fallback proposals, transparent HTTP 502/503 errors, and audit trails for quota and event tracking.【F:backend/app/services/gemini.py†L143-L433】【F:backend/app/services/status_reports.py†L120-L210】 |
| Operations / QA Analyst | Verify guardrails, quotas, and failure handling paths | Form validation, retry permissions, quota enforcement, and surfaced failure reasons for testing and support.【F:frontend/src/app/features/reports/reports-page.component.ts†L31-L109】【F:backend/app/services/status_reports.py†L120-L210】 |

## 4. Success Metrics

### Analyzer

| Metric | Target | Measurement |
| --- | --- | --- |
| Proposal adoption | ≥70% of generated proposals get published into the workspace store | Track how often `publishProposals` transfers Gemini output into the workspace compared with analysis responses received.【F:frontend/src/app/features/analyze/page.ts†L36-L138】 |
| Time to first proposal | p95 under 6 seconds from submission to first eligible proposal | Measure `/analysis` round-trip time, including Gemini request/response formatting and frontend resource delivery.【F:backend/app/services/gemini.py†L219-L274】【F:frontend/src/app/features/analyze/page.ts†L30-L74】 |
| Fallback rate | <5% of analysis responses rely on the generated fallback card | Compare responses containing `_fallback_card` output against total analysis calls to monitor model accuracy.【F:backend/app/services/gemini.py†L143-L167】【F:backend/app/services/gemini.py†L428-L433】 |

### Status Reports

| Metric | Target | Measurement |
| --- | --- | --- |
| Proposal delivery | 95% of successful submissions return proposals within the five-card quota and include detail payloads | Audit report processing to confirm AI proposals and detail data are persisted before completion.【F:backend/app/services/status_reports.py†L120-L240】 |
| Failure transparency | 100% of failed Gemini calls record a failure event and expose `failure_reason` to clients | Verify failure events and payload metadata when status reports enter the failed state.【F:backend/app/services/status_reports.py†L168-L210】【F:frontend/src/app/features/reports/reports-page.component.ts†L64-L109】 |
| Retry recovery | ≥70% of retries from failed reports succeed once upstream availability is restored | Track status transitions from `failed` to `completed` after retry submissions.【F:backend/app/services/status_reports.py†L180-L240】 |

## 5. User Stories & Acceptance Criteria

### Analyzer

1. **Submit analysis request** — As a facilitator, I can submit trimmed notes (and optional manual objectives) so empty payloads are rejected client-side and the backend augments prompts with my profile metadata.【F:frontend/src/app/features/analyze/page.ts†L57-L133】【F:backend/app/routers/analysis.py†L12-L27】【F:backend/app/services/gemini.py†L258-L325】
2. **Review filtered proposals** — As a workspace member, I can view only eligible proposals so duplicates or ineligible items are hidden before publishing.【F:frontend/src/app/features/analyze/page.ts†L36-L47】
3. **Publish to board** — As a facilitator, I can publish accepted proposals directly into the workspace store and clear the form for the next intake session.【F:frontend/src/app/features/analyze/page.ts†L81-L138】
4. **Handle AI failures gracefully** — As an operations lead, I receive fallback tasks or clear HTTP errors when Gemini misbehaves or configuration is missing.【F:backend/app/services/gemini.py†L143-L167】【F:backend/app/services/gemini.py†L455-L495】

### Status Reports

5. **Draft management** — As a team member, I can create and update drafts with structured sections so I can iterate before requesting AI analysis.【F:backend/app/services/status_reports.py†L28-L115】【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L91】
6. **Submit for analysis** — As a team lead, I can submit a report, trigger Gemini analysis, and review cards, proposals, and events when processing completes.【F:backend/app/services/status_reports.py†L120-L240】【F:frontend/src/app/features/reports/reports-page.component.ts†L47-L157】
7. **Retry failed reports** — As a team member, I can retry a failed report without retyping content, and the system preserves the event history across attempts.【F:backend/app/routers/status_reports.py†L88-L107】【F:backend/app/services/status_reports.py†L168-L210】
8. **Enforce guardrails** — As an operations analyst, I can confirm quotas, validation, and failure notifications to keep AI usage predictable.【F:frontend/src/app/features/reports/reports-page.component.ts†L31-L109】【F:backend/app/services/status_reports.py†L120-L210】

## 6. Functional Requirements

### Analyzer

1. **Authenticated analysis endpoint** — `/analysis` must require a logged-in user, build a profile snapshot, and pass it to Gemini to personalise prompts.【F:backend/app/routers/analysis.py†L12-L27】
2. **Request validation** — The frontend shall prevent submissions without meaningful notes or objectives, and the backend shall return empty proposal lists when `text` is blank after trimming.【F:frontend/src/app/features/analyze/page.ts†L57-L133】【F:backend/app/services/gemini.py†L143-L167】
3. **Prompt enrichment** — Gemini requests must include guidance text, max-card limits, and optional profile metadata encoded as JSON for personalised outputs.【F:backend/app/services/gemini.py†L219-L325】
4. **Response sanitisation** — Responses must be validated against the JSON schema, discard malformed cards or subtasks, and coerce strings/integers before returning proposals to the client.【F:backend/app/services/gemini.py†L46-L447】
5. **Workspace filtering & publishing** — The frontend must filter proposals via the workspace store eligibility check and only publish confirmed items back into the workspace state.【F:frontend/src/app/features/analyze/page.ts†L36-L138】
6. **AI-driven recommendation score** — When cards are published or created from analysis proposals, the backend must invoke an AI scoring service that calculates the `ai_confidence` value so clients cannot override persisted scores.
7. **Score persistence contract** — The card persistence layer shall treat `ai_confidence` as read-only for inbound requests, always replacing client-supplied values with the AI-generated score before storage and when emitting domain events.
8. **Telemetry for recommendation scoring** — The backend must log scoring latency and contributing feature weights (label correlation, profile match) at debug level so operations can validate the AI model while avoiding PII leakage.

### Status Reports

9. **Draft lifecycle** — Support create/read/update for drafts and failed reports with section normalisation, tag deduplication, and event logging.【F:backend/app/services/status_reports.py†L28-L170】【F:backend/app/routers/status_reports.py†L15-L64】
10. **Submission workflow** — Transition reports to processing, compose Gemini prompts, store proposals, and return detail payloads before marking reports complete.【F:backend/app/services/status_reports.py†L120-L240】【F:backend/app/routers/status_reports.py†L65-L107】
11. **Retry handling** — Allow retries only from the failed state while reusing stored content, preserving event history, and preventing concurrent submissions.【F:backend/app/routers/status_reports.py†L88-L107】【F:backend/app/services/status_reports.py†L168-L210】
12. **Detail payload contract** — Ensure responses include sections, cards, proposals, events, and processing metadata so clients can render comprehensive results and persist summaries externally.【F:backend/app/services/status_reports.py†L180-L240】【F:frontend/src/app/features/reports/reports-page.component.html†L120-L209】
13. **Quota enforcement** — Limit stored AI proposals per report (default five) and record created card IDs for auditing and follow-up workflows.【F:backend/app/services/status_reports.py†L12-L210】
14. **UI states** — Provide dynamic sections, pending-state locks, and success/error alerts in the report form to prevent duplicate submissions and guide user actions.【F:frontend/src/app/features/reports/reports-page.component.ts†L22-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L24-L209】

## 7. Derived Behaviours

### Analyzer workflow

- Users compose notes, optionally override the goal, and submit the form; submission prevents default browser behaviour and only proceeds when inputs are valid. The form resets after successful publication.【F:frontend/src/app/features/analyze/page.ts†L23-L109】【F:frontend/src/app/features/analyze/page.html†L9-L157】
- Auto-objective mode previews a synthesised goal based on the first meaningful line of notes; manual mode toggles a textarea for custom objectives and hides the preview when disabled.【F:frontend/src/app/features/analyze/page.ts†L31-L86】【F:frontend/src/app/features/analyze/page.html†L31-L83】
- Analyzer results filter out proposals failing workspace eligibility checks before showing cards or enabling publication actions; empty states and loading indicators cover the full lifecycle.【F:frontend/src/app/features/analyze/page.ts†L37-L118】【F:frontend/src/app/features/analyze/page.html†L89-L198】
- The backend authenticates the user, builds a profile, and proxies the request to Gemini with fallback to HTTP 502 on upstream errors.【F:backend/app/routers/analysis.py†L1-L27】

### Status report workflow

- Creation requires at least one section with body content; tags are normalised and duplicate-filtered. Draft creation records an event and stores sections as structured JSON.【F:backend/app/services/status_reports.py†L28-L101】
- The Angular form enforces a body for each section, blocks removal of the last section, supports dynamic sections, and prevents double submission while the request is pending.【F:frontend/src/app/features/reports/reports-page.component.ts†L19-L91】【F:frontend/src/app/features/reports/reports-page.component.html†L15-L118】
- Upon submission the UI surfaces errors or success messages, resets the form on success, and renders the latest detail payload including status badges, failure reasons, cards, proposals, sections, and event history.【F:frontend/src/app/features/reports/reports-page.component.ts†L47-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L120-L209】
- Backend submission transitions status to processing, invokes Gemini, stores generated proposals, and cleans up completed reports once detail data is delivered.【F:backend/app/services/status_reports.py†L120-L240】

## 8. Validation, Quotas, and Guardrails

- **Form validation** — Analyzer notes and manual objectives enforce non-empty text; status report sections require body content and always keep at least one section available. Pending submissions block duplicate requests.【F:frontend/src/app/features/analyze/page.ts†L63-L109】【F:frontend/src/app/features/reports/reports-page.component.ts†L31-L91】
- **Backend validation** — Report creation and updates reject payloads without meaningful sections (HTTP 422) and ensure retries or updates occur only in permitted states.【F:backend/app/services/status_reports.py†L41-L115】【F:backend/app/routers/status_reports.py†L39-L107】
- **Quota enforcement** — `_MAX_GENERATED_CARDS` restricts AI proposal storage to five items per report; processing metadata records pending proposals and created card IDs for auditing.【F:backend/app/services/status_reports.py†L12-L210】
- **AI fallback expectations** — Gemini errors mark reports as failed, capture `failure_reason`, leave drafts intact, and surface error alerts in the UI. The analyzer endpoint returns HTTP 502 on upstream failure, triggering UI error messaging.【F:backend/app/routers/analysis.py†L18-L27】【F:backend/app/services/status_reports.py†L168-L206】【F:frontend/src/app/features/reports/reports-page.component.ts†L64-L109】
- **Notification flows** — Success and error states use alert components; status report detail exposes failure reasons and status badges, while the analyzer surfaces loading, success, and empty states with clear messaging.【F:frontend/src/app/features/analyze/page.html†L101-L198】【F:frontend/src/app/features/reports/reports-page.component.html†L55-L209】
- **Reporting outcomes** — Detail payloads include sections, cards, pending proposals, events, and processing metadata; UI surfaces each grouping, and success toasts guide users to the board for follow-up.【F:frontend/src/app/features/reports/reports-page.component.ts†L51-L157】【F:frontend/src/app/features/reports/reports-page.component.html†L120-L209】【F:backend/app/services/status_reports.py†L180-L240】

## 9. Non-Functional Requirements

- **Reliability** — Misconfigured API keys or SDK issues surface as 503 errors during dependency injection, while runtime Gemini failures are logged, translated to 502 responses, and paired with fallback content where possible.【F:backend/app/services/gemini.py†L120-L495】【F:backend/app/services/status_reports.py†L168-L210】
- **Performance** — Gemini responses should complete within <30 seconds to avoid frontend timeouts; backend services must propagate upstream failures promptly for analyzer and status reports.【F:backend/app/routers/analysis.py†L18-L27】【F:backend/app/services/status_reports.py†L147-L207】
- **Security & Privacy** — All endpoints require authenticated workspace users, and profile metadata injected into prompts includes only sanitised fields to avoid leaking unrelated data.【F:backend/app/routers/analysis.py†L11-L27】【F:backend/app/services/gemini.py†L304-L325】【F:backend/app/routers/status_reports.py†L17-L104】
- **Usability & Accessibility** — Analyzer and report surfaces provide accessible ARIA labels, focus states, and descriptive empty/error messages for every state transition.【F:frontend/src/app/features/analyze/page.html†L9-L198】【F:frontend/src/app/features/reports/reports-page.component.html†L9-L209】
- **Observability** — Token usage and processing metadata are merged into responses so downstream analytics can track AI consumption, quota usage, and failure reasons.【F:backend/app/services/gemini.py†L203-L217】【F:backend/app/services/status_reports.py†L120-L210】

## 10. Recommendation Scoring Specification

1. **Input signals** — The scoring engine shall consume (a) the normalised card description and objectives derived from the analysis proposal, (b) the set of labels associated with the destination board, and (c) the requesting user's role, department, and competency metadata available in the profile snapshot.
2. **Label correlation factor** — The engine must compute a 0‑100 sub-score representing the semantic similarity between the card content and each board label, weighting the highest-matching label at ≥60% of the total correlation contribution.
3. **Profile alignment factor** — The engine must compute a 0‑100 sub-score indicating how well the proposed work aligns with the user's functional responsibilities, using role-to-label mappings and historical acceptance data when available.
4. **Composite scoring** — The final recommendation score shall be a weighted sum of the correlation and profile factors (default weights 0.6 and 0.4 respectively), clamped between 0 and 100, and rounded to the nearest integer before persistence.
5. **Model fallback** — If AI inference fails, the system must emit a score of 0 with an associated diagnostic flag so UI surfaces can signal low confidence rather than blocking card creation.
6. **Extensibility** — The scoring service shall expose configuration hooks for future feature inputs (e.g., proposal acceptance rates) without requiring schema changes to card records; additional inputs must default to neutral weightings when absent.
