# Todo Generator Feature Expansion Requirements

## 1. Background & Objectives
The existing Todo Generator already transforms unstructured input into structured task cards and offers base board management capabilities. However, advanced productivity scenarios require deeper insights into recurring mistakes, more powerful navigation of tasks, and actionable follow-up workflows. This expansion targets the following objectives:

- Provide flexible filtering and search so users can quickly surface relevant tasks.
- Reveal related tasks and subtasks to support knowledge reuse and reduce duplicate work.
- Enable multidimensional grouping (labels, statuses, error types) to highlight patterns.
- Analyze user feedback and task activity to spotlight frequent mistakes and error categories.
- Run multi-layered "Why-Why" root cause analysis with AI support and present the chain in an explorable UI.
- Suggest next actions for each identified cause and allow one-click ticket creation from those suggestions.
- Track improvement initiatives and measure their impact on mistake frequencies.
- Summarize improvement activities and analytics into report-ready narratives on demand.

## 2. Scope
### 2.1 In Scope
- Enhancements to board filtering, search, and grouping features across web UI and API.
- AI-assisted analytics pipeline that classifies mistakes, aggregates trends, and performs multi-level root cause analysis.
- UI components for displaying analytics, root cause chains, suggested actions, and improvement metrics.
- Backend data model and API changes to persist analytics artifacts, suggested actions, and improvement history.
- Report generation service that assembles textual summaries for export, copy, or sharing.

### 2.2 Out of Scope
- New external integrations beyond existing webhook framework (future work).
- Non-web clients (mobile/desktop native apps).
- Fully automated creation of tasks without user confirmation (user must approve suggestions).

## 3. Stakeholders & Personas
- **Product Managers:** need quick visibility into recurring issues, recommended mitigations, and improvement progress.
- **Engineering Leads:** require searchable knowledge of similar tasks, root causes, and action items to prioritize remediation.
- **QA/Support Specialists:** want to correlate error reports with historical tasks and understand resolution effectiveness.
- **Team Members:** need a lightweight way to convert improvement suggestions into actionable tickets and track completion.
- **Executives/Compliance Officers:** expect report-friendly summaries that evidence continuous improvement.

## 4. Glossary
- **Card:** Primary task entity containing metadata, subtasks, and analytics links.
- **Improvement Initiative:** A card or project spawned from root-cause suggestions aimed at reducing specific mistakes.
- **Why-Why Chain:** Ordered list of causal statements that drill down to a root cause.
- **Suggestion Node:** AI-generated next action recommendation tied to a cause.
- **Analytics Snapshot:** Aggregated metrics about mistakes, categories, and improvement outcomes for a time period.

## 5. User Stories
1. As a user, I can apply multi-field filters (label, status, assignee, priority, error category, time range) to narrow cards on the board.
2. As a user, I can search cards by keyword across titles, descriptions, comments, and AI rationale with highlighted results.
3. As a user, I can open a card and see recommended similar cards/subtasks with relevance scores and quick navigation.
4. As a user, I can group the board by labels, statuses, assignees, or analytics-derived attributes (error category, initiative).
5. As a QA specialist, I can view analytics that summarize the most frequent mistakes, their impact, and trends over time.
6. As a PM, I can inspect a Why-Why chain for a selected mistake, including AI explanations at each depth level.
7. As a PM, I can accept or refine suggested next actions per cause and convert them to tasks with one click.
8. As an engineering lead, I can monitor the progress and effectiveness of improvement initiatives derived from the analytics.
9. As an executive, I can generate a narrative report that explains issues, causes, actions, and outcomes in a structured document.

## 6. Functional Requirements
### 6.1 Filtering & Search
1. **Filter Builder:**
   - Support combinable conditions (AND/OR) across labels, statuses, assignees, priorities, due date ranges, creation date ranges, error categories, and initiative identifiers.
   - Provide quick presets (e.g., "My open tasks", "Critical issues", "Recent errors").
   - Persist last-used filters per user and allow saving named filter sets.
2. **Search:**
   - Full-text search across card title, summary, description, subtasks, comments, AI rationale, and analytics notes.
   - Return ranked results with snippet previews highlighting match terms.
   - Provide search within board (filter results inline) and global search page with advanced filters.
3. **Performance:**
   - Debounced search requests with typeahead suggestions.
   - Ensure query response <400 ms for cached data; fall back to asynchronous search with spinner when necessary.

### 6.2 Similar Tasks & Subtask Recommendations
1. **Similarity Index:**
   - Maintain embeddings for cards and subtasks via ChatGPT or vector store.
   - Expose API `GET /cards/{id}/similar` returning top N related cards/subtasks with similarity score, labels, statuses, and quick actions (open, duplicate, link).
2. **UI Presentation:**
   - Card detail view shows "Related Work" panel with collapsible sections for Cards and Subtasks.
   - Provide ability to link/unlink related items and mark suggestions as "Not Relevant" to improve future recommendations.
3. **Feedback Loop:**
   - Capture user relevance feedback to adjust similarity weights (store in analytics table).

### 6.3 Advanced Grouping
1. Extend board grouping controls to include:
   - Labels, statuses, assignees (existing).
   - Error category, root cause cluster, improvement initiative, time bucket (week/month).
2. Allow nested grouping (e.g., first by label, within each column by error category) with collapsible sections.
3. Persist group configuration per user and allow quick toggle between saved grouping presets.

### 6.4 Mistake & Error Analytics
1. **Data Ingestion:**
   - Collect feedback from card updates, comments flagged as "issue", and imported mistake reports.
   - Normalize raw text with AI classification into error categories, severity, impacted component, and frequency metrics.
2. **Dashboard:**
   - Provide analytics dashboard route showing charts: top mistake categories, trend lines, heat map by label vs. severity.
   - Allow drill-down from charts into filtered card lists.
3. **Notifications:**
   - Send periodic summaries (weekly) with significant changes in mistake frequency.
4. **Storage:**
   - Maintain `analytics_snapshots` table capturing metrics per period, including computed KPIs (MTTR, recurrence rate, success rate of actions).

### 6.5 Why-Why Root Cause Analysis
1. **Trigger:**
   - User selects an error category or specific card to generate analysis via `POST /analytics/{id}/why-why` endpoint.
2. **AI Workflow:**
   - Service constructs structured prompt with context (historical data, recent actions) and requests ChatGPT for 3-5 causal layers.
   - Capture for each layer: cause statement, confidence score, evidence references, recommended metrics.
3. **UI:**
   - Display results as an interactive tree/timeline with ability to expand/collapse layers.
   - Provide inline editing of cause statements and allow marking as confirmed, rejected, or needs review.
4. **Versioning:**
   - Preserve history of analyses with timestamps and authors; allow comparing versions.

### 6.6 Suggested Next Actions & Task Creation
1. **Suggestion Generation:**
   - For each cause node, generate 2-3 actionable recommendations with metadata (effort estimate, expected impact, owner role, due date suggestion).
2. **Approval Workflow:**
   - Users can accept, edit, or dismiss suggestions. Accepted suggestions become tasks.
   - Support bulk acceptance and direct conversion to card/subtask via `POST /actions/{id}/convert` endpoint.
3. **One-Click Ticketing:**
   - When a suggestion is accepted, prepopulate new card modal with suggestion details and link back to originating analysis.
4. **Traceability:**
   - Link created tasks to the cause node; display completion status in analytics views.

### 6.7 Improvement Activity Tracking
1. **Metrics Capture:**
   - Track progress (status, completion date, owner) of tasks tied to improvement initiatives.
   - Log key outcomes (observed metric change, qualitative notes) at completion time.
2. **Dashboard Widgets:**
   - Show initiative list with health indicators (on track, at risk) and aggregated impact (e.g., 30% reduction in critical errors).
3. **Timeline View:**
   - Provide chronological timeline of actions taken vs. mistake frequency for correlation analysis.
4. **Permissions:**
   - Restrict editing of initiative status to owners or admins; all users can view.

### 6.8 Report Generation
1. **Report Builder:**
   - Allow user to specify period, audience, formatting tone (formal, executive summary, technical), and sections.
   - Compose narrative summarizing mistake patterns, causes, actions taken, and outcomes using analytics data plus AI-generated prose.
2. **Output Options:**
   - Provide preview in UI with ability to copy, export to PDF/Markdown, or send via email.
3. **Template Management:**
   - Let admins define reusable report templates with custom section ordering and placeholders.
4. **Audit:**
   - Store generated reports with metadata (author, timestamp, dataset version) for future reference.

## 7. Non-Functional Requirements
- Maintain API response times under 500 ms for filter/search queries; asynchronous tasks (analytics generation) must provide progress endpoints.
- Ensure AI prompt logs are redacted and stored securely with role-based access.
- Similarity computations and analytics jobs should be scheduled to avoid impacting interactive performance; use background workers.
- Provide fallback UI states when AI services are unavailable, allowing manual entry of causes/actions.
- Support incremental rollout behind feature flags, enabling opt-in for pilot teams.

## 8. Data Model Updates
| Entity | Description | Key Fields |
| --- | --- | --- |
| `cards` (existing) | Extend with `error_category_id`, `initiative_id`, `ai_similarity_vector` reference, `analytics_notes`. | FK to `error_categories`, `improvement_initiatives`. |
| `subtasks` (existing) | Extend with `ai_similarity_vector`, `root_cause_node_id` link. | Vector reference stored externally if needed. |
| `error_categories` | Master table for categorized mistakes. | id, name, description, severity_level. |
| `analytics_snapshots` | Periodic aggregates. | id, period_start/end, metrics JSON, generated_by. |
| `root_cause_analyses` | Header for each Why-Why session. | id, target_type (card/category), target_id, created_by, created_at, version, status. |
| `root_cause_nodes` | Nodes in the Why-Why chain. | id, analysis_id, depth, statement, confidence, evidence_refs, parent_id, state. |
| `suggested_actions` | AI-generated recommendations. | id, node_id, title, description, effort_estimate, impact_score, owner_role, due_date_hint, status. |
| `improvement_initiatives` | Track improvement programs. | id, name, description, owner, start_date, target_metrics, status. |
| `initiative_progress_logs` | Historical records of initiative updates. | id, initiative_id, timestamp, status, notes, observed_metrics. |
| `report_templates` | Configurable report layouts. | id, name, audience, sections JSON. |
| `generated_reports` | Stored outputs. | id, template_id, filters JSON, content, created_by, created_at. |
| `similarity_feedback` | User feedback on recommendations. | id, source_type, source_id, related_item_id, rating, notes, created_by. |

- Vector data may be stored in dedicated service (e.g., PostgreSQL pgvector or external vector DB) referenced by IDs.
- Introduce background job queue tables if not already present (e.g., `analytics_jobs`).

## 9. API Enhancements
- `GET /cards/search`: accepts filter JSON and query string; returns paginated cards with highlights.
- `POST /filters`: create named filter set; `GET /filters` list saved filters.
- `GET /cards/{id}/similar`: returns similar cards/subtasks.
- `POST /analytics/mistakes`: ingest mistake records from external systems.
- `GET /analytics/dashboard`: returns aggregated metrics for UI.
- `POST /analytics/{target}/why-why`: initiates analysis; returns job ID.
- `GET /analytics/jobs/{id}`: fetch status and results when ready.
- `POST /suggested-actions/{id}/accept`: convert suggestion into card/subtask.
- `GET /initiatives`: list improvement initiatives with metrics; `POST /initiatives` for manual creation.
- `POST /initiatives/{id}/logs`: append progress log entries.
- `POST /reports/generate`: create new report; `GET /reports/{id}` fetch stored content.

All new endpoints must enforce authentication, respect RBAC permissions, and support pagination/filters where applicable.

## 10. Frontend Requirements
- Extend state management to store filter presets, analytics data, root cause chains, and improvement initiative state.
- Create new feature modules:
  - **Analytics Module:** dashboards, mistake trends, initiative timelines.
  - **Root Cause Module:** Why-Why viewer/editor and suggestion management.
  - **Reporting Module:** report builder, template management, generated report history.
- Update board module to integrate enhanced filtering/search/grouping controls.
- Provide responsive layouts for analytics and report pages, with cards/lists optimized for desktop and tablet.
- Ensure accessibility (keyboard navigation, ARIA labels) for new interactive components (filter builder, tree views).

## 11. AI & Data Processing Considerations
- Define prompt templates for similarity embedding, mistake classification, and Why-Why generation.
- Cache embeddings to reduce repeated computations; update when card content changes significantly.
- Implement guardrails for AI outputs (confidence thresholds, manual review flags when confidence <0.6).
- Log user corrections to improve prompt fine-tuning and track AI effectiveness.
- Provide transparency: display AI confidence levels and data sources used for each inference.

## 12. Security & Compliance
- Ensure analytics data respects privacy constraints; allow excluding personally identifiable information from prompts.
- Maintain audit logs for root cause edits, suggestion approvals, and report generation.
- Support data retention policies (e.g., ability to purge analytics for deleted cards or users).
- Enforce least privilege: only authorized roles can access analytics dashboards or generate reports.

## 13. Success Metrics
- Reduction in average time to locate relevant tasks by 30% (measured via event telemetry).
- Increase in improvement initiative completion rate and measurable decline in top 3 mistake categories within 3 months of adoption.
- User satisfaction scores >4/5 for analytics and reporting capabilities.
- AI suggestion acceptance rate >40% with <10% marked as not relevant after review.

## 14. Rollout Plan
1. **Phase 1:** Backend data model & API groundwork; release basic filtering/search enhancements.
2. **Phase 2:** Deploy similarity recommendations and analytics dashboard behind beta flag.
3. **Phase 3:** Launch Why-Why analysis, suggestion conversion, and initiative tracking to pilot teams.
4. **Phase 4:** Release reporting module and gather feedback; iterate on templates and export formats.
5. **Phase 5:** GA release with metrics monitoring and playbooks for support teams.

## 15. Open Questions
- Preferred vector store technology (pgvector vs. managed service?).
- Required compliance certifications for analytics data retention.
- Localization needs for analytics terminology and report outputs.
- Should improvement initiative KPIs integrate with external BI tools?
- Frequency and scope of automated report generation (scheduled emails?).
