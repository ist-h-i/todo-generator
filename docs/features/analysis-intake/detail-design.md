# Analysis Intake Detailed Design

## Document Control
| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Engineering Team |
| Last Updated | 2024-07-01 |
| Status | Draft |

## 1. Sequence Overview
1. The analyzer form validates and trims input, synthesises an objective when `autoObjective` is enabled, and writes a request payload into a signal once all local checks pass.【F:frontend/src/app/features/analyze/page.ts†L53-L133】
2. `AnalysisGateway` observes the request signal, posts the payload to `/analysis`, and maps the persisted response into a resource object consumed by the page component.【F:frontend/src/app/core/api/analysis-gateway.ts†L1-L149】
3. The FastAPI router resolves the authenticated user, records the submission in `analysis_sessions`, builds a profile snapshot, and delegates to the Gemini client for proposal generation.【F:backend/app/routers/analysis.py†L1-L51】【F:backend/app/models.py†L753-L768】
4. The Gemini client assembles prompts and response formats, invokes the Google AI Responses API, normalizes returned cards/subtasks, and appends a fallback card when necessary before sending the payload back to the frontend.【F:backend/app/services/gemini.py†L123-L241】
5. The analyzer page filters proposals through `WorkspaceStore` eligibility checks and offers publishing/reset actions to push accepted cards into the workspace state.【F:frontend/src/app/features/analyze/page.ts†L36-L138】

## 2. Request Validation
### Frontend Form Guards
- `createSignalForm` initializes `notes`, `objective`, and `autoObjective` controls, preventing accidental null payloads.【F:frontend/src/app/features/analyze/page.ts†L24-L33】
- `dispatchAnalyze` invokes `createRequestPayload`, which trims whitespace, rejects blank notes, and blocks manual submissions without an objective.【F:frontend/src/app/features/analyze/page.ts†L57-L133】
- `handleSubmit` prevents native form submission to keep SPA state intact and rely entirely on reactive signals.【F:frontend/src/app/features/analyze/page.ts†L66-L74】

### Backend Schema & Sanitization
- `AnalysisRequest` (imported schema) ensures FastAPI receives validated payloads; the router records the submission and passes the object to the Gemini client, which then trims `request.text` for defensive checks.【F:backend/app/routers/analysis.py†L1-L51】【F:backend/app/services/gemini.py†L138-L167】
- When the trimmed text is empty, the client returns an empty `AnalysisResponse` without calling Google AI, shielding the system from unnecessary token usage.【F:backend/app/services/gemini.py†L143-L167】

## 3. Gemini Profile Enrichment & Prompt Composition
- The router generates a `UserProfile` from the authenticated user before invoking Gemini.【F:backend/app/routers/analysis.py†L20-L23】
- `_build_response_format` clones the base JSON schema, enforces the `max_cards` limit, and sets `strict=True` so Google AI validates output before returning it.【F:backend/app/services/gemini.py†L219-L256】
- `_build_user_prompt` concatenates guidance, optional profile metadata, and the original notes. Profile metadata includes sanitized identifiers, experience, roles, bios, and timestamps rendered as formatted JSON.【F:backend/app/services/gemini.py†L258-L325】
- `_request_analysis` packages the prompt and schema, invokes `responses.create`, normalizes missing `model` metadata, and feeds the payload into downstream parsing routines.【F:backend/app/services/gemini.py†L219-L243】

## 4. Proposal Filtering & Publishing
- `analysisResource` exposes the latest response; `eligibleProposals` filters it with `WorkspaceStore.isProposalEligible`, keeping duplicates or conflicting tasks off the page.【F:frontend/src/app/features/analyze/page.ts†L32-L47】
- `hasEligibleProposals` and `hasResult` computed signals drive template states (empty, loading, results).【F:frontend/src/app/features/analyze/page.ts†L45-L48】
- `publishProposals` imports approved proposals into the workspace store and resets the form so future submissions start from a clean slate.【F:frontend/src/app/features/analyze/page.ts†L81-L138】
- `resetForm` clears current proposals and form values without publishing, supporting discard actions during review.【F:frontend/src/app/features/analyze/page.ts†L89-L138】

## 5. Error Handling & Fallback Behaviour
### Backend
- Gemini client initialization fails fast when API keys are missing or the SDK is not installed, raising `GeminiConfigurationError`, which the dependency layer converts to HTTP 503 responses.【F:backend/app/services/gemini.py†L120-L212】
- During analysis, Google AI or JSON parsing failures are logged and wrapped in `GeminiError`. The router records the failure reason and translates these into HTTP 502 errors for the caller.【F:backend/app/services/gemini.py†L148-L200】【F:backend/app/routers/analysis.py†L37-L49】
- `_parse_card` and `_parse_subtask` skip malformed entries, while `_fallback_card` ensures at least one proposal is returned if Google AI does not provide usable content.【F:backend/app/services/gemini.py†L387-L433】
- `_extract_content` and `_parse_json_payload` recover from streaming/fenced JSON responses, reducing noise from model variations.【F:backend/app/services/gemini.py†L326-L371】

### Frontend
- If validation fails locally, `dispatchAnalyze` returns early and leaves the previous response untouched, preventing unnecessary API calls.【F:frontend/src/app/features/analyze/page.ts†L57-L64】【F:frontend/src/app/features/analyze/page.ts†L115-L133】
- `publishProposals` guards against empty arrays before writing to the store, avoiding redundant imports when Gemini returns zero eligible proposals.【F:frontend/src/app/features/analyze/page.ts†L81-L87】
- `resetAnalyzeForm` clears both the form state and the request signal, ensuring stale responses are not re-rendered after errors or cancellations.【F:frontend/src/app/features/analyze/page.ts†L135-L138】

## 6. Task Proposal Label & Status Data Flow

The analyser keeps label assignments intact by piping workspace metadata from the backend into the Gemini prompt and reusing the response when publishing cards.

1. When the analyze form fires, `AnalysisGateway` trims the payload, posts it to `/analysis`, and prepares to map the response with the current workspace settings so downstream consumers can resolve status and label identifiers locally.【F:frontend/src/app/core/api/analysis-gateway.ts†L300-L355】
2. The `/analysis` router loads the authenticated user, builds workspace options, and persists the submission before handing the request to the Gemini client. Those options query the owner’s statuses and labels (creating defaults if missing) so the AI receives the authoritative catalogue and preferred defaults.【F:backend/app/routers/analysis.py†L20-L60】【F:backend/app/services/gemini.py†L940-L977】
3. `_compose_workspace_guidance` embeds the status and label lists into the system prompt, including explicit instructions to always pick at least one known label or author a new concise value when no match exists. This guidance is what ensures Gemini echoes label identifiers back in its structured response.【F:backend/app/services/gemini.py†L523-L588】
4. On receipt, `AnalysisGateway` resolves the suggested status and label IDs against the cached workspace catalogue and hands them to `WorkspaceStore.createCardFromSuggestion`, which deduplicates label IDs and includes them in the create request so the stored card preserves the AI selections.【F:frontend/src/app/core/api/analysis-gateway.ts†L347-L383】【F:frontend/src/app/core/state/workspace-store.ts†L1707-L1772】
