# Verbalize Yourself Feature Expansion Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 0.9 (Draft) |
| Author | Product Design Team |
| Last Updated | 2024-05-09 |
| Status | For stakeholder review |

## 1. Background & Objectives
Verbalize Yourself is an AI-guided reflection workspace (AIガイドのリフレクションワークスペース) that currently converts free-form input into structured tasks and persists them on a collaborative board. Foundational capabilities such as basic filtering, card management, and webhook-based integrations are already in place. However, people relying on the product for deep self-reflection workflows need deeper insight into recurring patterns, faster knowledge discovery, and actionable follow-through. The feature expansion outlined in this document pursues three top-level objectives:

1. **Insight Acceleration:** surface meaningful patterns about mistakes, their drivers, and high-impact improvement opportunities without requiring manual spreadsheet work.
2. **Execution Guidance:** guide teams from analytics into concrete actions via AI-assisted recommendations, streamlined conversion to tickets, and initiative tracking.
3. **Storytelling Efficiency:** equip leaders with report-ready narratives summarizing issues, causes, mitigation actions, and observed outcomes.

## 2. Problem Statement & Success Metrics
### 2.1 Problems to Solve
- Users cannot easily narrow large boards to the specific subset of tasks or mistakes they care about.
- Tribal knowledge about similar tasks and past fixes is buried in historical cards and comments.
- Teams invest significant effort to explain recurring mistakes and justify improvement initiatives to stakeholders.
- AI-generated insights are disconnected from action, producing "analysis without ownership".

### 2.2 Success Metrics
| Metric | Target | Measurement Approach |
| --- | --- | --- |
| Filter usage adoption | 60% of active users apply saved filters weekly | Product analytics (events: `filter_saved`, `filter_applied`) |
| Duplicate task reduction | 25% decrease in duplicate card creation within 90 days | Compare baseline duplication rate vs. post-launch period |
| Suggestion conversion rate | 40% of AI suggestions accepted or edited then converted to tasks | Track `suggestion.accepted`, `suggestion.converted` events |
| Report generation adoption | 30% of workspaces generate at least one report per month | Count unique workspaces hitting `reports.generate` endpoint |
| Improvement effectiveness | 20% reduction in recurrence of targeted mistakes within two reporting periods | Compare analytics snapshot metrics over time |

## 3. Scope
### 3.1 In Scope
- Enhancements to board filtering, search, and grouping functionality in both the frontend application and supporting APIs.
- AI-assisted analytics pipeline that classifies mistakes, aggregates trends, and generates multi-depth Why-Why analyses.
- UI components and backend services for rendering analytics dashboards, root cause chains, suggested actions, and initiative tracking.
- Backend persistence for analytics artifacts, suggested actions, Why-Why history, improvement initiatives, and generated reports.
- Report builder that composes exportable narratives combining analytics data with AI-authored summaries.

### 3.2 Out of Scope
- New third-party integrations beyond the existing webhook framework (future backlog).
- Native mobile or desktop clients; enhancements apply to the web application only.
- Fully autonomous task creation—users must approve AI-generated suggestions prior to ticket creation.
- Major redesign of existing authentication, user management, or billing flows.

## 4. Stakeholders & Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Product Manager | Understand recurring issues and communicate improvement plans | High-level analytics, Why-Why exploration, report export |
| Engineering Lead | Prioritize remediation work and avoid repeating mistakes | Similar task discovery, initiative progress tracking |
| QA / Support Specialist | Correlate new reports with historic incidents | Fast filtering, related card discovery, trend visualization |
| Team Member | Action insights with minimal overhead | One-click conversion of suggestions to tasks, lightweight approvals |
| Executive / Compliance Officer | Validate reflective programs | Narrative reports, audit history, evidence of impact |

## 5. Glossary
- **Card:** Primary task entity containing metadata, subtasks, comments, and links to analytics artifacts.
- **Improvement Initiative:** A structured effort spawned from root-cause analysis to reduce a specific mistake category.
- **Why-Why Chain:** Ordered list of causal statements drilling down to underlying root causes.
- **Suggestion Node:** AI-generated recommendation tied to a cause, awaiting user approval.
- **Analytics Snapshot:** Aggregated metrics about mistakes, categories, and improvement outcomes for a defined time period.
- **Root Cause Analysis (RCA):** The process of identifying causal relationships behind an issue via human and AI collaboration.

## 6. Current State Summary
- Board view supports limited filtering (status, assignee) and manual search.
- Cards and subtasks lack semantic similarity data; related work is curated manually.
- Analytics are basic counts surfaced via webhook payloads; no native visualization.
- Report generation is ad hoc and manual, typically performed outside the product.
- Feature flags exist at workspace level but are not yet used for analytics capabilities.

## 7. User Journeys
1. **Focused Board Review:** A PM applies an existing filter preset ("Critical backend issues in last 14 days"), reviews grouped results by error category, and drills into a card to view similar incidents.
2. **Why-Why Session:** An engineering lead selects a spike in "Deployment failures" from the analytics dashboard, triggers a Why-Why analysis, collaborates with AI to refine causes, and approves suggested follow-up actions.
3. **Action Conversion:** A team member receives a notification about new recommendations, edits the wording of a suggestion, converts it to a task, and links it to an ongoing initiative.
4. **Reporting Loop:** At the end of the month, an executive requests a report using the "Executive summary" template, reviews AI-generated narrative, adds notes, and exports it to PDF for stakeholders.

## 8. User Stories & Acceptance Criteria
1. **Advanced Filtering**
   - *Story:* As a user, I can apply multi-field filters (label, status, assignee, priority, error category, initiative, time range).
   - *Acceptance:* Users can save, name, and reapply filter sets; results update within 400 ms for cached queries.
2. **Full-Text Search**
   - *Story:* As a user, I can search across titles, descriptions, comments, and AI rationale with highlighted results.
   - *Acceptance:* Search results show ranked snippets and allow inline filtering by entity type (card vs. subtask).
3. **Related Work Discovery**
   - *Story:* As a user, I can open a card to view recommended similar cards/subtasks with relevance scores.
   - *Acceptance:* Users can mark suggestions as "Not relevant" and the system records feedback.
4. **Analytics Insight**
   - *Story:* As a QA specialist, I can view charts summarizing frequent mistakes, their impact, and trends.
   - *Acceptance:* Dashboard supports drill-down to filtered board views; snapshots persist per reporting period.
5. **Why-Why Exploration**
   - *Story:* As a PM, I can review a Why-Why chain with AI explanations at each depth.
   - *Acceptance:* Users can edit cause statements, mark statuses (confirmed/rejected/needs review), and version history is maintained.
6. **Action Conversion**
   - *Story:* As a PM, I can accept or refine suggested actions and convert them to tasks with one click.
   - *Acceptance:* Conversion prepopulates a new card modal and links the resulting task back to the originating cause.
7. **Initiative Tracking**
   - *Story:* As an engineering lead, I can monitor initiative progress and effectiveness.
   - *Acceptance:* Timeline view correlates initiative milestones with mistake frequency trends; permissions restrict edits to owners/admins.
8. **Narrative Reporting**
   - *Story:* As an executive, I can generate a narrative report that explains issues, causes, actions, and outcomes.
   - *Acceptance:* Reports can be previewed, copied, exported to PDF/Markdown, emailed, and stored with metadata.

## 9. Functional Requirements
### 9.1 Filtering & Search
1. **Filter Builder**
   - Support combinable conditions (AND/OR) across labels, statuses, assignees, priorities, due date ranges, creation date ranges, error categories, and initiative identifiers.
   - Provide quick presets (e.g., "My open tasks", "Critical issues", "Recent errors").
   - Persist last-used filters per user and allow saving, renaming, deleting, and sharing named filter sets.
2. **Search Experience**
   - Full-text search across card title, summary, description, subtasks, comments, AI rationale, and analytics notes.
   - Return ranked results with snippet previews highlighting matched terms; allow filtering by entity type and date.
   - Support both inline board search (results update current view) and a dedicated search page with advanced filters.
3. **Performance & Resilience**
   - Debounce search requests with typeahead suggestions after 250 ms of idle time.
   - Ensure query response <400 ms for cached data; fall back to asynchronous search with loading indicator and toasts on timeout.

### 9.2 Similar Tasks & Subtask Recommendations
1. **Similarity Index**
   - Maintain embeddings for cards and subtasks via the existing vector store pipeline; update embeddings within 5 minutes of card edits.
   - Expose API `GET /cards/{id}/similar` returning top N related cards/subtasks with similarity score, labels, statuses, and quick actions (open, duplicate, link).
2. **UI Presentation**
   - Card detail view includes a "Related Work" panel with collapsible sections for Cards and Subtasks.
   - Users can link/unlink related items, mark suggestions as "Not relevant", and trigger regeneration.
3. **Feedback Loop**
   - Capture user relevance feedback to adjust similarity weights; store decisions in analytics tables for model retraining.

### 9.3 Advanced Grouping
1. Extend board grouping controls to include labels, statuses, assignees, error category, root cause cluster, improvement initiative, and time bucket (week/month).
2. Support nested grouping (e.g., group by label, then by error category) with collapsible sections and persisted user preferences.
3. Allow sharing grouping presets within a workspace.

### 9.4 Mistake & Error Analytics
1. **Data Ingestion**
   - Collect feedback from card updates, comments flagged as "issue", and imported mistake reports.
   - Normalize raw text with AI classification into error categories, severity, impacted component, and frequency metrics.
2. **Dashboard**
   - Provide analytics dashboard with charts: top mistake categories, trend lines, heatmap by label vs. severity, and initiative impact summary.
   - Allow drill-down from charts into filtered board views or specific cards.
3. **Notifications**
   - Send weekly summaries with significant changes in mistake frequency or initiative impact to subscribed users.
4. **Storage**
   - Maintain `analytics_snapshots` table capturing metrics per period, including computed KPIs (MTTR, recurrence rate, success rate of actions).

### 9.5 Why-Why Root Cause Analysis
1. **Trigger & Workflow**
   - Endpoint `POST /analytics/{id}/why-why` initiates analysis for a given snapshot or card; includes contextual payload (recent tasks, metrics).
2. **AI Collaboration**
   - Construct structured prompt with context, request 3-5 causal layers from ChatGPT, and capture for each layer: cause statement, confidence score, evidence references, recommended metrics.
   - Allow manual edits and flag causes for human follow-up.
3. **UI**
   - Display results as interactive tree/timeline with expand/collapse, inline editing, and status badges.
4. **Versioning**
   - Preserve history of analyses with timestamps, author, and AI model version; allow comparison between versions.

### 9.6 Suggested Next Actions & Task Creation
1. **Suggestion Generation**
   - For each cause node, generate 2-3 actionable recommendations with metadata (effort estimate, expected impact, owner role, due date suggestion).
2. **Approval Workflow**
   - Users can accept, edit, or dismiss suggestions individually or in bulk. Accepted suggestions become tasks via `POST /actions/{id}/convert` endpoint.
3. **One-Click Ticketing**
   - Conversion prepopulates the new card modal with suggestion details and links back to the originating analysis.
4. **Traceability**
   - Created tasks link to the cause node; completion status is visible from analytics views.

### 9.7 Improvement Activity Tracking
1. **Metrics Capture**
   - Track progress (status, completion date, owner) of tasks tied to improvement initiatives.
   - Log outcomes (observed metric change, qualitative notes) upon completion.
2. **Dashboard Widgets**
   - Display initiative list with health indicators (on-track, at-risk, off-track) and aggregated impact (e.g., 30% reduction in critical errors).
3. **Timeline View**
   - Show chronological timeline of actions taken vs. mistake frequency for correlation analysis.
4. **Permissions**
   - Restrict editing of initiative status to owners or admins; all workspace members can view.

### 9.8 Report Generation
1. **Report Builder**
   - Allow user to specify period, audience, tone (formal, executive summary, technical), sections, and initiative focus.
   - Compose narrative summarizing mistake patterns, causes, actions, and outcomes using analytics data plus AI-generated prose.
2. **Output Options**
   - Provide preview in UI with copy, export to PDF/Markdown, and send via email options.
3. **Template Management**
   - Admins can define reusable report templates with custom section ordering, placeholders, and branding elements.
4. **Audit**
   - Store generated reports with metadata (author, timestamp, dataset version, template ID) for future reference.

## 10. Non-Functional Requirements
- Maintain API response times under 500 ms for filter/search queries; asynchronous analytics jobs must expose progress endpoints.
- Ensure AI prompt logs are redacted, encrypted at rest, and accessible only to authorized roles.
- Similarity computations and analytics jobs run on background workers to avoid impacting interactive performance.
- Provide graceful degradation when AI services are unavailable, allowing manual entry/editing of causes and actions.
- Support incremental rollout behind feature flags with workspace opt-in and monitoring dashboards.
- Ensure accessibility compliance (WCAG 2.1 AA) for new UI components, including keyboard navigation and screen-reader support.

## 11. System Architecture & Components
| Component | Updates | Notes |
| --- | --- | --- |
| Frontend Web App | Extend board filter builder, search UI, analytics dashboard, RCA tree, initiative timeline, and report builder modals/pages. | React SPA with Redux state slices for filters, analytics, and initiatives. |
| Backend API | New endpoints for analytics, RCA, suggestions, initiatives, and reports; enhancements to card query endpoints. | Built with FastAPI; leverage asynchronous tasks via Celery workers. |
| Analytics Service | Pipeline for classification, trend aggregation, and RCA prompt orchestration. | Uses message queue to schedule processing; stores results in analytics tables. |
| Vector Store | Maintain embeddings for cards/subtasks and support similarity queries. | Use existing Pinecone cluster; nightly re-index job for stale vectors. |
| Notification Service | Generate weekly summaries and RCA updates. | Reuse existing email infrastructure and webhook notifications. |
| Feature Flag Service | Manage phased rollout per workspace. | Integrate with LaunchDarkly SDK already used by backend. |

## 12. Data Model Updates
| Entity | Description | Key Fields / Notes |
| --- | --- | --- |
| `cards` (existing) | Extend with `error_category_id`, `initiative_id`, `ai_similarity_vector_id`, `analytics_notes`. | Foreign keys to `error_categories`, `improvement_initiatives`; vector stored in external index with reference ID. |
| `subtasks` (existing) | Extend with `ai_similarity_vector_id`, `root_cause_node_id`. | Allows back-linking to specific RCA nodes. |
| `error_categories` | Master table for categorized mistakes. | `id`, `name`, `description`, `severity_level`. |
| `analytics_snapshots` | Periodic aggregates of mistake metrics. | `id`, `period_start`, `period_end`, `metrics_json`, `generated_by`, `workspace_id`. |
| `root_cause_analyses` | Header for each Why-Why session. | `id`, `target_type`, `target_id`, `created_by`, `created_at`, `version`, `status`. |
| `root_cause_nodes` | Nodes within a Why-Why chain. | `id`, `analysis_id`, `depth`, `statement`, `confidence`, `evidence_refs`, `parent_id`, `state`. |
| `suggested_actions` | AI-generated recommendations tied to causes. | `id`, `node_id`, `title`, `description`, `effort_estimate`, `impact_score`, `owner_role`, `due_date_hint`, `status`. |
| `improvement_initiatives` | Track improvement programs and link to actions. | `id`, `name`, `description`, `owner`, `start_date`, `target_metrics`, `status`. |
| `initiative_progress_logs` | Historical records of initiative updates. | `id`, `initiative_id`, `timestamp`, `status`, `notes`, `observed_metrics`. |
| `report_templates` | Configurable report layouts. | `id`, `name`, `audience`, `sections_json`, `branding`. |
| `generated_reports` | Persisted report outputs for audit. | `id`, `template_id`, `author_id`, `generated_at`, `parameters_json`, `content`, `export_urls`. |

## 13. API Changes
- `GET /cards` – extend query parameters to support additional filters (labels[], error_category_id, initiative_id, created_from/to, due_from/to, priority, include_related=true).
- `GET /cards/{id}/similar` – returns `{ items: [{ id, type, title, similarity, labels, status }] }`.
- `POST /filters` / `GET /filters` – CRUD for saved filter definitions.
- `GET /analytics/snapshots` – list aggregated metrics with pagination and filtering by period.
- `POST /analytics/{id}/why-why` – trigger RCA generation; respond with job ID.
- `GET /analytics/why-why/{analysis_id}` – retrieve analysis tree, suggestions, and history.
- `POST /suggested-actions/{id}/convert` – convert a suggestion into a task; accepts overrides for title, assignee, due date, labels.
- `GET /initiatives` / `POST /initiatives` / `PATCH /initiatives/{id}` – manage improvement initiatives and view linked tasks.
- `GET /reports/templates` / `POST /reports/templates` – manage templates; `POST /reports/generate` to create new report artifacts.
- `GET /reports/{id}` – retrieve generated report content and metadata.

## 14. UX & Interaction Design Requirements
- Provide consistent toolbar for filters/search with clear indication when presets are active; allow quick reset.
- Use stacked bar charts and heatmaps for analytics; tooltips show counts, percentages, and sparkline comparisons vs. previous period.
- RCA tree uses left-to-right orientation with badges for confidence (High/Medium/Low) and statuses.
- Suggestions display estimated effort (S/M/L) and expected impact (Low/Medium/High) with pill chips.
- Initiative timeline uses combined Gantt line + event markers showing correlated mistake metrics.
- Reports preview in rich text editor with ability to edit AI-generated content before export.
- Ensure responsive layout for dashboards and RCA views down to 1280px width.

## 15. Security, Privacy & Compliance
- Mask personally identifiable information (PII) before sending data to AI services; maintain audit log of prompts/responses.
- Respect workspace data residency requirements; analytics storage must follow existing regional deployments.
- Enforce RBAC: only workspace admins can manage report templates and initiatives; RCA edits limited to authorized roles.
- Provide data retention controls allowing deletion of analytics snapshots, RCAs, and reports per compliance requests.

## 16. Telemetry, Observability & Operations
- Instrument key events: `filter.saved`, `search.executed`, `similar.clicked`, `rca.generated`, `suggestion.accepted`, `initiative.updated`, `report.generated`.
- Add dashboards monitoring queue latency for analytics jobs and success/error rates for AI calls.
- Set alerts for vector indexing delays (>10 minutes) and RCA job failures (>5% failure rate in 1 hour).
- Log user edits to RCAs and initiatives for audit trails.

## 17. Rollout Strategy
1. **Private Beta (Weeks 1-4)**
   - Enable for 3 pilot workspaces; collect feedback on filter builder, analytics, and RCA accuracy.
   - Manually monitor AI outputs and adjust prompts based on reviewer input.
2. **Public Beta (Weeks 5-8)**
   - Gradually roll out to 25% of workspaces via feature flag; enable opt-in messaging within product.
   - Launch in-app onboarding checklist and tooltips.
3. **General Availability (Week 9+)**
   - Remove opt-in, enable automated weekly reports by default (with user opt-out).
   - Publish release notes, tutorial video, and update support documentation.

## 18. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI-generated causes/actions are inaccurate | Erodes trust, manual rework | Provide clear editing controls, collect feedback, retrain prompts, include confidence scores |
| Performance degradation from complex filters | Slower boards | Implement query caching, background indexing, performance tests before rollout |
| Data model migrations disrupt existing boards | Possible downtime | Apply backward-compatible migrations, use feature flags, rehearse rollback |
| Report exports fail under load | Missed deadlines | Queue exports, pre-generate PDFs during off-peak hours, add retry logic |
| Privacy concerns about analytics data | Compliance risk | Review with legal, implement data residency + retention policies |

## 19. Open Questions
- Should we allow cross-workspace analytics aggregation for organizations managing multiple workspaces?
- What level of customization is required for AI prompts per workspace (e.g., domain-specific terminology)?
- Do we need inline collaboration (comments, @mentions) within the RCA view for synchronous workshops?
- How do we price the expansion—bundled with existing plans or as an add-on?

## 20. Next Steps
1. Validate scope and success metrics with stakeholders (Product, Engineering, Customer Success).
2. Produce UX wireframes for filter builder, analytics dashboard, and RCA tree.
3. Estimate engineering effort, align on phased delivery milestones, and create project plan in Jira.
4. Define data migration scripts and background jobs for initializing analytics snapshots.
5. Prepare support and marketing collateral ahead of beta launch.
