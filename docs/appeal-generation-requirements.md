# Appeal Narrative Generation Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 0.1 (Draft) |
| Author | Product Design Team |
| Last Updated | 2024-05-15 |
| Status | For internal review |

## 1. Background & Objectives
Continuous improvement programs within Verbalize Yourself rely on card histories to demonstrate progress and communicate lessons learned. Stakeholders often request concise narratives that explain what challenges were faced, the actions taken, and how those actions delivered results. Currently, teams manually craft these narratives using disparate documents, leading to inconsistent messaging and slow reporting cycles. The Appeal Narrative Generation capability will automate narrative creation from existing card achievements while giving users granular control over structure and tone.

Objectives:
1. Enable users to produce coherent, causal narratives based on existing card accomplishments without rewriting raw data.
2. Provide a configurable storytelling flow aligned with continuous improvement practices (e.g., issue → action → outcome).
3. Support multiple output formats so teams can quickly reuse narratives in reports, chats, or presentations.

## 2. Problem Statement & Success Metrics
### 2.1 Problems to Solve
- Manual narrative drafting from card achievements is time consuming and inconsistent across teams.
- Existing exports lack guided structures that connect challenges, actions, and results in a causal flow.
- Users cannot tailor narrative depth or format to fit different audiences (executives vs. team retrospectives).

### 2.2 Success Metrics
| Metric | Target | Measurement Approach |
| --- | --- | --- |
| Narrative generation adoption | 40% of workspaces produce at least one appeal narrative per month within 60 days of launch | Track `appeal.generate` events per workspace |
| Editing effort reduction | 50% of narratives are shared without manual rewriting | Post-generation survey prompt + telemetry on immediate share/download without edit |
| Positive feedback | ≥80% satisfaction score on in-product feedback modal | In-app micro-survey |

## 3. Scope
### 3.1 In Scope
- UI flow enabling users to select a subject (card label set or custom text) and configure narrative steps.
- Narrative flow builder allowing 1–5 ordered steps selected from predefined selectors (課題, 実績, 対策, 行動計画, 所感, 自由入力).
- Format options supporting plain text, bullet list, table, and Markdown outputs with multi-select capability.
- AI-assisted generation that stitches achievements into a causal story adhering to selected steps and subject.
- Preview, edit, and export of generated narratives.
- Telemetry for feature usage, edits, and exports.

### 3.2 Out of Scope
- Automatic detection of optimal flows without user input (future enhancement).
- Translation/localization beyond Japanese UI strings delivered for the initial release.
- New integrations with external publishing platforms (export remains copy/download only).

## 4. Stakeholders & Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Continuous Improvement Lead | Communicate progress to executives | Fast, consistent narratives aligned with improvement frameworks |
| Team Facilitator | Share lessons learned during retrospectives | Flexible formats, ability to emphasize actions and feelings |
| Customer Success Manager | Showcase value to clients | Customizable subjects referencing specific achievements |
| Executive Sponsor | Quickly assess impact | Concise, causal summaries without reading individual cards |

## 5. User Stories & Acceptance Criteria
1. **Subject Selection**
   - *Story:* As a user, I can choose the subject of the narrative from a list of card labels or enter custom text.
   - *Acceptance:* Subject selector displays existing card label groups with search; custom input field allows up to 120 characters and persists within the session.

2. **Flow Configuration**
   - *Story:* As a user, I can define an ordered narrative flow with causal relationships.
   - *Acceptance:* UI enforces selection of 1–5 steps; available options: 課題, 実績, 対策, 行動計画, 所感, 自由入力. Steps can be reordered via drag-and-drop; generation request validates causal ordering (e.g., 課題 must precede 実績 if both selected).

3. **Format Selection**
   - *Story:* As a user, I can choose one or more output formats.
   - *Acceptance:* Users can multi-select from 平文, 箇条書き, 表形式, マークダウン. Each selected format produces a dedicated preview pane.

4. **Narrative Generation**
   - *Story:* As a user, I can generate a causal narrative using selected subject, flow, and formats.
   - *Acceptance:* Backend composes prompt with subject context, step descriptions, and card achievements; response must contain paragraphs aligned to each step. Generation time under 8 seconds for 95th percentile requests.

5. **Editing & Export**
   - *Story:* As a user, I can edit and export the generated narrative.
   - *Acceptance:* Inline editor supports text adjustments per format; exports include copy to clipboard and download as Markdown/CSV (for table) within two clicks.

6. **Error Handling**
   - *Story:* As a user, I receive actionable feedback if generation fails.
   - *Acceptance:* Retry option with preserved configuration; fallback message encourages manual editing with templated placeholders.

## 6. Functional Requirements
1. **Subject Data Access**
   - Retrieve available card labels and associated achievement summaries via backend endpoint.
   - Allow injection of free-form subject text while ensuring it is sanitized (no HTML injection).

2. **Flow Builder Logic**
   - Enforce 1–5 step limit and prevent duplicates unless user explicitly toggles "同一ステップを複数回使用" flag (MVP: duplicates disabled).
   - Validate causal ordering rules: 課題 → 対策 → 行動計画 → 実績 → 所感 is recommended default; warn if user deviates from recommended progression.
   - Provide inline descriptions per selector to guide user expectations.

3. **Format Rendering**
   - Plain text: generate coherent paragraphs connecting steps.
   - Bullet list: render ordered or unordered list, one bullet per step.
   - Table: produce two-column table (Step label, Narrative content).
   - Markdown: combine headings per step followed by descriptive text.

4. **Generation Service**
   - Construct prompt using selected subject, chronological achievements, and flow metadata.
   - Ensure outputs include explicit causal connectors between steps (e.g., "そのため", "結果として").
   - Store generation metadata (subject, steps, formats, tokens used) for analytics.

5. **Editing Surface**
   - Support undo/redo, basic formatting (bold, italics) where applicable.
   - Allow regeneration per step or entire narrative while preserving edits in other formats when feasible.

6. **Export & Sharing**
   - Copy to clipboard respects selected format markup.
   - Download options: `.md` for Markdown/plain text, `.txt` for bullet list, `.csv` for table.
   - Log export events with references to workspace and subject.

## 7. Non-Functional Requirements
- **Performance:** 95th percentile generation response under 8 seconds; UI should remain interactive with loading indicators and cancel option.
- **Reliability:** Provide graceful degradation when AI service unavailable, offering templated manual entry with placeholders per step.
- **Security & Privacy:** Mask sensitive card data before sending to AI; respect workspace data residency policies; persist prompts/responses in encrypted storage with 30-day retention.
- **Accessibility:** Flow builder and previews must be fully keyboard navigable, screen-reader friendly, and meet WCAG 2.1 AA.
- **Localization:** All UI labels available in Japanese; system should be extensible for future locales.

## 8. Data Model & API Updates
| Component | Update |
| --- | --- |
| Backend API | `GET /appeals/config` returns available subjects (label groups) and default flows; `POST /appeals/generate` accepts subject, flow array, format array, and optional free-form achievements context; responds with generated content per format. |
| Persistence | New table `appeal_generations` storing `id`, `workspace_id`, `subject_type`, `subject_value`, `flow`, `formats`, `content_json`, `created_by`, `created_at`, `token_usage`. |
| Telemetry | Emit events: `appeal.flow_configured`, `appeal.generate`, `appeal.export`. |

## 9. UX & Interaction Notes
- Provide wizard-like modal: Step 1 Subject, Step 2 Flow, Step 3 Formats & Preview.
- Prepopulate recommended flow (課題 → 対策 → 実績 → 所感) with ability to modify.
- Display causal guidance tips between steps (e.g., "実績は課題・対策に紐づく具体的な成果を記載します").
- Loading state includes progress indicator and option to cancel generation.
- Highlight AI-generated text with subtle badge and disclosure statement.

## 10. Telemetry, Observability & Operations
- Track generation duration, token usage, and retry rate in dashboards.
- Alert if failure rate >5% over 10-minute window or average response time >12 seconds.
- Maintain audit log of manual edits applied before export for compliance review.

## 11. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Narratives feel generic or inaccurate | User distrust, manual rewriting | Allow per-step regeneration, capture qualitative feedback, iteratively refine prompts |
| Overly complex flow setup deters usage | Low adoption | Provide default templates, inline guidance, and saveable presets (future enhancement) |
| AI service downtime | Blocked workflows | Implement caching of recent generations and manual template fallback |

## 12. Open Questions
- Should users be able to save custom flow templates for reuse across teams?
- Do we need role-based restrictions on who can generate appeal narratives?
- How should we handle narratives that require multiple subjects (e.g., cross-team achievements)?

## 13. Next Steps
1. Validate requirement document with Product, Engineering, and Customer Success stakeholders.
2. Produce wireframes for subject selector, flow builder, and multi-format preview.
3. Estimate engineering effort and define phased delivery milestones.
4. Align AI prompt design with legal/compliance review for data handling.
5. Prepare onboarding content and in-app walkthrough for beta launch.
