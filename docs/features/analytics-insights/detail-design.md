# Analytics & Continuous Improvement Detailed Design

## 1. Purpose
Analytics & Continuous Improvement is the cross-cutting capability that supports everything from board filtering to administrator dashboards. It links saved filters, snapshots, Why-Why analyses, suggested actions, initiative management, and AI-generated report drafts into one consistent experience.【F:frontend/src/app/features/analytics/page.ts†L1-L112】【F:backend/app/routers/analytics.py†L1-L200】

## 2. Component Overview
- **WorkspaceStore** – Maintains cards, labels, and statuses with Signals and syncs filters and grouping preferences to local storage.【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
- **BoardPage** – Offers quick filters, card grouping, and drag-and-drop interactions while mapping WorkspaceStore state to the UI.【F:frontend/src/app/features/board/page.ts†L1-L160】
- **ContinuousImprovementStore** – Manages analytics snapshots, cause trees, suggested actions, initiatives, and report drafts in one place.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】
- **Analytics Router** – Handles snapshot CRUD, Why-Why generation, suggested action expansion, and initiative updates.【F:backend/app/routers/analytics.py†L16-L200】
- **Filters Router** – Provides saved filter CRUD with per-user access control.【F:backend/app/routers/filters.py†L1-L78】
- **SQLAlchemy models** – `AnalyticsSnapshot`, `RootCauseAnalysis`, `RootCauseNode`, `SuggestedAction`, `ImprovementInitiative`, and `InitiativeProgressLog` persist continuous improvement data.【F:backend/app/models.py†L301-L439】

## 3. Board Filtering Design
WorkspaceStore keeps filter, grouping, and template settings in Signals and recomputes board columns and summary metrics whenever they change. Quick filters map predefined IDs to explanations rendered in the UI.【F:frontend/src/app/core/state/workspace-store.ts†L83-L160】【F:frontend/src/app/features/board/page.ts†L29-L145】 Saved filters integrate with the `/filters` API, and any request from a non-owner returns 404.【F:backend/app/routers/filters.py†L33-L78】

## 4. Analytics API Flows
### 4.1 Snapshots
Administrators send date ranges, metrics, and narratives to `/analytics/snapshots` to create records. Querying uses `period_start` and `period_end` overlap logic to filter results.【F:backend/app/routers/analytics.py†L16-L64】 Snapshots persist metrics JSON, narratives, and creator information.【F:backend/app/models.py†L301-L318】

### 4.2 Why-Why Analyses
`POST /analytics/{target}/why-why` resolves the snapshot or card target, generates cause nodes and suggested actions, and saves them.【F:backend/app/routers/analytics.py†L65-L200】 Nodes store depth, confidence, evidence, and recommended metrics, while suggested actions capture title, description, effort, impact, owner role, and due-date hints.【F:backend/app/models.py†L318-L427】 Suggested actions can spawn up to two additional actions from follow-up hints.【F:backend/app/routers/analytics.py†L80-L163】

### 4.3 Initiatives
`ImprovementInitiative` records link to suggested actions and maintain progress logs. When a card is created from a Why-Why analysis, a progress event is appended.【F:backend/app/models.py†L332-L364】【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L200】

## 5. Frontend Dashboard
`AnalyticsPage` combines WorkspaceStore and ContinuousImprovementStore to display counts by status and label, story point totals, snapshot data, cause trees, suggested actions, and report drafts.【F:frontend/src/app/features/analytics/page.ts†L1-L112】 Card conversion and snapshot switching call store methods so Signals immediately update the UI.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L75-L200】

## 6. Report Draft Generation
ContinuousImprovementStore stores user prompts and assembles Markdown-based report drafts from the selected snapshot, cause nodes, and suggested actions. Switching snapshots automatically rebuilds the draft.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L130-L147】

## 7. Data Model
| Model | Key Fields |
| --- | --- |
| `AnalyticsSnapshot` | `period_start`, `period_end`, `metrics`, `narrative`, `generated_by`【F:backend/app/models.py†L301-L318】 |
| `RootCauseAnalysis` | `target_type`, `version`, `status`, `summary`, `nodes`, `suggestions`【F:backend/app/models.py†L318-L363】 |
| `RootCauseNode` | `depth`, `statement`, `confidence`, `state`, `recommended_metrics`【F:backend/app/models.py†L363-L381】 |
| `SuggestedAction` | `title`, `description`, `effort_estimate`, `impact_score`, `owner_role`, `due_date_hint`, `status`, `initiative_id`, `created_card_id`【F:backend/app/models.py†L381-L427】 |
| `ImprovementInitiative` | `status`, `health`, `progress_logs`, `suggested_actions`【F:backend/app/models.py†L332-L364】 |

## 8. Security & Access Control
The Analytics router requires the `require_admin` dependency so only administrators can access it.【F:backend/app/routers/analytics.py†L16-L32】 Saved filters rely on creator ID checks to block unauthorized access.【F:backend/app/routers/filters.py†L33-L78】

## 9. Telemetry
- Log snapshot creation and updates to monitor usage by period and track failure rates.
- Persist `created_card_id` when converting suggested actions so we can measure conversion rate and lead time.【F:backend/app/models.py†L381-L427】
- Segment the frontend with Signals so the analytics SDK can capture user behavior per section.【F:frontend/src/app/features/analytics/page.ts†L65-L112】

## 10. Test Strategy
- **Unit tests** – Validate WorkspaceStore/ContinuousImprovementStore state transitions, filter restoration, and report generation logic.
- **API tests** – Cover `/filters` and `/analytics` CRUD, date filtering, Why-Why generation, suggested action branching, and access control.
- **End-to-end scenarios** – Verify the flow from choosing a snapshot through card conversion and report draft updates via the UI.
