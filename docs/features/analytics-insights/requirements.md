# Analytics & Continuous Improvement Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Strategy Team |
| Last Updated | 2024-06-30 |
| Status | Approved |

## 1. Background & Objectives
Cards that represent daily improvement work already accumulate on the workspace boards, but the legacy board experience makes it hard to understand the biggest issues, analyze causes, and manage follow-up. The Analytics & Continuous Improvement feature delivers a connected flow that covers filtering, root-cause analysis, initiative tracking, and reporting.【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/features/analytics/page.ts†L1-L112】【F:backend/app/routers/analytics.py†L1-L200】

### Objectives
1. Allow users to quickly narrow the board to relevant tasks and visualize trends in story points and status.【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
2. Let administrators create analytics snapshots and Why-Why analyses so they can manage root causes and suggested actions systematically.【F:backend/app/routers/analytics.py†L16-L200】【F:backend/app/models.py†L301-L439】
3. Enable teams to monitor initiative progress and report drafts from dashboards, and reuse AI-generated summaries across the team.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】

## 2. Success Metrics
| Metric | Target | Measurement |
| --- | --- | --- |
| Saved filter reuse rate | 60% of active users apply a saved filter at least once per week | `filter_saved` / `filter_applied` events |
| Analytics snapshot utilization | 50% of administrators create a snapshot at least once per month | `/analytics/snapshots` POST logs |
| Suggested action conversion rate | 40% of suggested actions become cards | Ratio of `SuggestedAction.created_card_id` values【F:backend/app/models.py†L381-L427】|
| Report generation adoption | 30% of workspaces using the dashboard create a draft report each month | `report.generate` events |

## 3. Scope
### In Scope
- Quick filters, label/status filtering, grouping switches, and summary statistics on the board.【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/core/state/workspace-store.ts†L1-L200】
- Saved filter CRUD API (`/filters`) and the save/apply experience on the frontend.【F:backend/app/routers/filters.py†L1-L78】
- Analytics API endpoints for creating and retrieving snapshots, running Why-Why analyses, and generating suggested actions.【F:backend/app/routers/analytics.py†L16-L200】
- Persistence of continuous improvement data through Root Cause / Suggested Action / Initiative models.【F:backend/app/models.py†L301-L427】
- Frontend `ContinuousImprovementStore` flows for selecting snapshots, browsing cause trees, converting suggested actions to cards, and generating report drafts.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L200】

### Out of Scope
- Automatic export to external BI tools.
- Mobile-only UI.
- Fully automated card creation by AI without approval.

## 4. Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Product Manager | Understand recurring issues and prioritize improvement work | Trend views by label/status and cause trees |
| Engineering Lead | Turn suggested actions into tasks | One-click card conversion and progress tracking |
| Executive Sponsor | Review improvement results in regular reports | AI-generated report drafts and KPI deltas |

## 5. User Stories & Acceptance Criteria
1. **Board Filtering** – Users can narrow the card list with quick filters, labels, statuses, and text search. Filter state is stored so drag-and-drop operations keep the active filters.【F:frontend/src/app/features/board/page.ts†L1-L160】【F:frontend/src/app/core/state/workspace-store.ts†L83-L160】
2. **Filter Persistence** – Users can save, update, and delete filters, and only the creator can view them. The `/filters` API returns records for the authenticated user only.【F:backend/app/routers/filters.py†L1-L78】
3. **Analytics Snapshots** – Administrators specify a date range and metrics to create snapshots, retrieve the list via the API, and inspect details. Range filtering uses date-overlap logic for start/end values.【F:backend/app/routers/analytics.py†L16-L64】
4. **Why-Why Analyses** – Administrators can generate Why-Why analyses from snapshots or cards, and the system auto-creates cause nodes and suggested actions with titles, descriptions, effort, and owner roles.【F:backend/app/routers/analytics.py†L65-L200】【F:backend/app/models.py†L344-L427】
5. **Suggested Action Conversion** – Users can convert suggested actions into cards. After conversion, the action is saved with `status='converted'` and the card ID.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L189】
6. **Initiative Tracking** – Initiatives store progress logs and summaries so dashboards can show status and health.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L108-L198】【F:backend/app/models.py†L332-L364】
7. **Report Drafting** – Users enter instructions to generate AI report drafts, and switching snapshots refreshes the draft content.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L130-L147】

## 6. Functional Requirements
### 6.1 Board & Filters
- Quick filters include `myAssignments`, `dueSoon`, `recentlyCreated`, `highPriority`, and `noAssignee`, and their labels are localized in the UI.【F:frontend/src/app/features/board/page.ts†L29-L59】
- Recently used filters and grouping preferences are stored in local storage and restored on the next visit.【F:frontend/src/app/core/state/workspace-store.ts†L22-L160】
- Saved filter definitions can persist arbitrary JSON, and the API returns 404 when someone other than the owner tries to access a filter.【F:backend/app/routers/filters.py†L33-L78】

### 6.2 Analytics & Why-Why
- Snapshots store date ranges, metrics, and narratives in JSON columns and return results in descending order.【F:backend/app/routers/analytics.py†L16-L64】【F:backend/app/models.py†L301-L318】
- Why-Why analyses manage depth-based nodes, suggested actions, and recommended metrics linked to snapshots or cards.【F:backend/app/models.py†L318-L427】
- Suggested actions capture title, description, effort, impact, responsible role, and due-date candidates, and can spawn up to two additional follow-up actions.【F:backend/app/routers/analytics.py†L80-L163】

### 6.3 Continuous Improvement UI
- The frontend store keeps snapshots, analyses, and initiatives in Angular Signals and regenerates report drafts whenever the selection changes.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L24-L147】
- When converting suggested actions to cards, pass the title, summary, recommended status, and labels to the card creation helper and append a progress log entry.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L200】

## 7. Non-Functional Requirements
- **Performance** – Board interactions re-render within 50 ms, and the snapshot API responds within 400 ms even when filtered by date range.
- **Security** – The Analytics API is available only to users who pass the administrator guard.【F:backend/app/routers/analytics.py†L16-L32】
- **Reliability** – If an error occurs while generating a Why-Why analysis, roll back the created nodes so users can retry.【F:backend/app/routers/analytics.py†L98-L200】
- **Observability** – Record metrics when creating snapshots and suggested actions, and raise an alert when the failure rate exceeds 5%.

## 8. Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| Users get lost in complex filter settings | Provide recommended quick filters and saved presets, and automatically restore the last-used settings.【F:frontend/src/app/core/state/workspace-store.ts†L83-L160】 |
| Suggested actions are ignored | Visualize converted status on the dashboard and append progress logs automatically.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L148-L200】 |
| Unauthorized access to analytics data | Require admin permission checks on all Analytics routes.【F:backend/app/routers/analytics.py†L16-L32】 |

## 9. Open Questions
- How should we support requests to customize snapshot KPI definitions per workspace?
- Do we need to extend the data schema so feedback summaries can automatically link to initiatives?
