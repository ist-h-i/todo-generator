# Appeal Narrative Generation Requirements

## Document Control

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Design Team |
| Last Updated | 2024-06-30 |
| Status | Approved |

## 1. Background & Objectives

Creating appeal narratives from card activity histories used to take time because every owner applied a different structure and tone when preparing reviews or internal submissions. The Appeal Narrative Generation feature uses card achievements and selected structure elements to generate consistent narratives with AI, keeping report quality aligned.【F:backend/app/routers/appeals.py†L1-L27】【F:backend/app/services/appeals.py†L1-L200】

### Objectives

1. Let users choose the appeal subject from a label or custom text and adjust a 1–5 step causal structure based on recommended flows.【F:backend/app/services/appeals.py†L32-L115】
2. Generate Markdown, bullet list, and CSV table formats at the same time, with each format easy to edit or export.【F:backend/app/services/appeals.py†L32-L152】
3. Return fallback copy and save the generation history when Google AI calls fail so users can keep working on reports.【F:backend/app/services/appeals.py†L106-L162】【F:backend/app/repositories/appeals.py†L17-L50】

## 2. Success Metrics

| Metric | Target | Measurement |
| --- | --- | --- |
| Adoption of generated narratives | 60% of outputs are shared or submitted after edits | Analyze `appeal.generate` and `appeal.export` events |
| Generation time | p95 within 8 seconds | API latency logs |
| Retry rate | Under 10% | Count of fallbacks and retries |

## 3. Scope

### In Scope

- Retrieve label lists, recommended flows, and supported formats through `/appeals/config`.【F:backend/app/services/appeals.py†L70-L115】
- Generate appeals through `/appeals/generate`, including XSS masking, Gemini calls, fallback construction, and history storage.【F:backend/app/services/appeals.py†L78-L155】
- Return JSON that includes generation output, token usage, and warning messages.【F:backend/app/services/appeals.py†L145-L163】
- Persist generation history in the `appeal_generations` table and retrieve the latest 20 records.【F:backend/app/models.py†L708-L723】【F:backend/app/repositories/appeals.py†L17-L50】

### Out of Scope

- Template editing in the UI (planned separately).
- PDF export or workspace-level sharing controls.
- Multilingual support and selecting multiple labels at once.

## 4. Personas

| Persona | Goals | Key Needs |
| --- | --- | --- |
| Continuous Improvement Lead | Keep executive-facing reports consistent | Recommended flows and automatic format assembly |
| Team Facilitator | Share achievements during retrospectives | Summaries with highlighted wins |
| Customer Success Manager | Prepare customer appeal materials quickly | Reusable Markdown and CSV documents |

## 5. User Stories & Acceptance Criteria

1. **Config retrieval** – Users review recommended flows and available formats. `GET /appeals/config` returns the user's labels, the suggested flow `Problem → Action → Result → Reflection`, and the three formats `markdown`, `bullet_list`, and `table`.【F:backend/app/services/appeals.py†L70-L115】
2. **Generation request** – Users specify subject/type/flow/formats when triggering generation. Flow and format values cannot repeat, are limited to 1–5 steps, and label subjects validate label ownership.【F:backend/app/schemas.py†L1015-L1059】【F:backend/app/services/appeals.py†L84-L103】
3. **Achievement integration** – For label subjects, fetch linked achievements, sanitize them, and feed them into prompts and fallback content.【F:backend/app/services/appeals.py†L101-L135】【F:backend/app/services/appeals.py†L169-L199】
4. **Fallback handling** – When the Gemini call fails, build format-specific fallback text, return `generation_status='fallback'`, and include warnings.【F:backend/app/services/appeals.py†L106-L162】【F:backend/app/services/appeal_prompts.py†L96-L173】
5. **History storage** – After generation, save subject, flow, formats, warnings, and token usage, and include the generation ID in the response.【F:backend/app/services/appeals.py†L145-L163】【F:backend/app/repositories/appeals.py†L17-L41】

## 6. Functional Requirements

1. **Subject handling** – For the `label` type, verify ownership and load the label name; for `custom`, escape HTML and limit the text to 120 characters.【F:backend/app/services/appeals.py†L84-L175】
2. **Achievements retrieval** – When a label is selected, gather card achievements chronologically and mask personal data in titles and summaries before use.【F:backend/app/services/appeals.py†L101-L199】
3. **Prompt composition** – Use Jinja templates to include flow descriptions, format definitions, and causal connectors in the prompt. If template loading fails, run only the fallback flow.【F:backend/app/services/appeal_prompts.py†L21-L118】【F:backend/app/services/appeals.py†L54-L144】
4. **Response validation** – Validate Gemini responses against a JSON schema and merge body content with token usage per format.【F:backend/app/services/appeal_prompts.py†L120-L156】【F:backend/app/services/appeals.py†L117-L138】
5. **Warnings** – When users choose flows outside the recommended causal order, append warning entries that the UI can display.【F:backend/app/services/appeals.py†L272-L279】

## 7. Non-Functional Requirements

- **Reliability** – Return fallback content when Gemini is misconfigured or times out, avoiding HTTP 503 errors.【F:backend/app/services/appeals.py†L106-L162】
- **Security** – Mask emails and phone numbers in subjects and achievements, and escape HTML.【F:backend/app/services/appeals.py†L169-L199】
- **Observability** – Log generation time and fallback rate, and emit metrics so we can alert when the 8-second SLA is exceeded.【F:backend/app/services/appeals.py†L117-L145】
- **Extensibility** – Manage format definitions with class variables to support future additions.【F:backend/app/services/appeals.py†L32-L75】

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Fallback text sounds too generic | Include achievements and flow information in the template and reinforce causality with connectors.【F:backend/app/services/appeal_prompts.py†L96-L173】 |
| Label sharing causes data leaks | Combine ownership checks with masking so other workspace data never appears.【F:backend/app/services/appeals.py†L84-L199】 |
| Gemini configuration mistakes | Log warnings when prompt builder initialization fails and fall back automatically to limit the blast radius.【F:backend/app/services/appeals.py†L54-L143】 |

## 9. Open Questions

- When should we surface the generation history UI, and how many records should it display?
- How will we manage workspace-level requests to customize the recommended flow?
