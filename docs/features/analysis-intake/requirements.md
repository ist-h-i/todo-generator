# Analysis Intake Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Design Team |
| Last Updated | 2024-07-01 |
| Status | Draft |

## 1. Goals & Background
The analysis intake flow converts free-form workspace notes into structured task proposals so that facilitators can triage AI suggestions alongside existing cards. The `/analysis` endpoint enriches each request with the signed-in user's profile before delegating to the ChatGPT client, letting prompts reflect roles, experience, and bios while keeping authentication centralized.【F:backend/app/routers/analysis.py†L12-L27】【F:backend/app/services/chatgpt.py†L219-L325】 When ChatGPT responses arrive, the backend validates them against a strict JSON schema, normalizes malformed entries, and inserts fallback cards whenever no usable output is returned, guaranteeing that the UI always receives actionable proposals.【F:backend/app/services/chatgpt.py†L46-L167】【F:backend/app/services/chatgpt.py†L387-L433】 On the frontend, the analyzer page gathers notes, synthesizes objectives, and filters proposals through the workspace store so only eligible cards can be published back to the board.【F:frontend/src/app/features/analyze/page.ts†L24-L138】

## 2. Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Sprint Facilitator | Turn retrospective notes into prioritized actions without retyping context | Rapid intake with eligible proposal filtering and one-click publishing into the workspace board.【F:frontend/src/app/features/analyze/page.ts†L36-L87】 |
| Product Engineer | Capture personal improvement goals and auto-generate objectives aligned with their profile | Automatic objective synthesis that reflects the first meaningful note line and ChatGPT prompts that mirror profile metadata.【F:frontend/src/app/features/analyze/page.ts†L53-L132】【F:backend/app/services/chatgpt.py†L258-L325】 |
| Operations Lead | Monitor AI adoption while ensuring misconfigurations fail gracefully | Guaranteed fallback proposals and HTTP 502/503 error mapping that signal configuration issues without blocking workflows.【F:backend/app/services/chatgpt.py†L143-L433】【F:backend/app/services/chatgpt.py†L480-L495】 |

## 3. Success Metrics
| Metric | Target | Measurement |
| --- | --- | --- |
| Proposal adoption | ≥70% of generated proposals get published into the workspace store | Track how often `publishProposals` transfers ChatGPT output into the workspace compared with analysis responses received.【F:frontend/src/app/features/analyze/page.ts†L36-L138】 |
| Time to first proposal | p95 under 6 seconds from submission to first eligible proposal | Measure `/analysis` round-trip time, including ChatGPT request/response formatting and frontend resource delivery.【F:backend/app/services/chatgpt.py†L219-L274】【F:frontend/src/app/features/analyze/page.ts†L30-L74】 |
| Fallback rate | <5% of analysis responses rely on the generated fallback card | Compare responses containing `_fallback_card` output against total analysis calls to monitor model accuracy.【F:backend/app/services/chatgpt.py†L143-L167】【F:backend/app/services/chatgpt.py†L428-L433】 |

## 4. User Stories & Acceptance Criteria
1. **Submit analysis request** – As a facilitator, I can submit trimmed notes (and optional manual objectives) so that empty payloads are rejected client-side and the backend augments prompts with my profile metadata.【F:frontend/src/app/features/analyze/page.ts†L57-L133】【F:backend/app/routers/analysis.py†L12-L27】【F:backend/app/services/chatgpt.py†L258-L325】
2. **Review filtered proposals** – As a workspace member, I can view only eligible proposals so duplicates or ineligible items are hidden before publishing.【F:frontend/src/app/features/analyze/page.ts†L36-L47】
3. **Publish to board** – As a facilitator, I can publish accepted proposals directly into the workspace store and clear the form for the next intake session.【F:frontend/src/app/features/analyze/page.ts†L81-L138】
4. **Handle AI failures gracefully** – As an operations lead, I receive fallback tasks or clear HTTP errors when ChatGPT misbehaves or configuration is missing.【F:backend/app/services/chatgpt.py†L143-L167】【F:backend/app/services/chatgpt.py†L455-L495】

## 5. Functional Requirements
1. **Authenticated analysis endpoint** – `/analysis` must require a logged-in user, build a profile snapshot, and pass it to ChatGPT to personalise prompts.【F:backend/app/routers/analysis.py†L12-L27】
2. **Request validation** – The frontend shall prevent submissions without meaningful notes or objectives, and the backend shall return empty proposal lists when `text` is blank after trimming.【F:frontend/src/app/features/analyze/page.ts†L57-L133】【F:backend/app/services/chatgpt.py†L143-L167】
3. **Prompt enrichment** – ChatGPT requests must include guidance text, max-card limits, and optional profile metadata encoded as JSON for personalised outputs.【F:backend/app/services/chatgpt.py†L219-L325】
4. **Response sanitisation** – Responses must be validated against the JSON schema, discard malformed cards or subtasks, and coerce strings/integers before returning proposals to the client.【F:backend/app/services/chatgpt.py†L46-L447】
5. **Workspace filtering & publishing** – The frontend must filter proposals via the workspace store eligibility check and only publish confirmed items back into the workspace state.【F:frontend/src/app/features/analyze/page.ts†L36-L138】

## 6. Non-Functional Requirements
- **Reliability** – Misconfigured API keys or SDK issues should surface as 503 errors during dependency injection, while runtime ChatGPT failures should be logged and translated to 502 responses with fallback content when possible.【F:backend/app/services/chatgpt.py†L120-L495】
- **Usability** – Auto-generated objectives must mirror the user's first meaningful line, supporting Japanese phrasing out of the box, so facilitators can quickly confirm context.【F:frontend/src/app/features/analyze/page.ts†L96-L133】
- **Security & Privacy** – Profile metadata injected into prompts should include only sanitized fields (ID, email, nickname, experience, roles, bio, timestamps) to avoid leaking unrelated workspace data.【F:backend/app/services/chatgpt.py†L304-L325】
- **Observability** – Token usage from OpenAI responses must be merged into payloads when available so downstream analytics can track consumption.【F:backend/app/services/chatgpt.py†L203-L217】
