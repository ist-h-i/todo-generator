# Backend-Persisted User Operations

This note inventories the user flows that must persist data through the FastAPI backend instead of handling state only in the Angular client. Each operation relies on the shipped routers and models so that teams share a durable workspace and maintain an auditable history of decisions.

## Board & Task Management
- **Cards and subtasks** – All CRUD operations, drag-and-drop status changes, completion timestamps, and nested subtask actions are handled via `/cards` and `/cards/{card_id}/subtasks` endpoints.【F:backend/app/routers/cards.py†L203-L598】
- **Comments and timeline history** – Comment creation, edits, deletions, and the associated activity log events persist through `/comments` and `/activity-log` routes.【F:backend/app/routers/comments.py†L14-L174】【F:backend/app/routers/activity.py†L14-L60】
- **Manual activity logging** – Operators can append ad-hoc timeline entries by posting to `/activity-log`, ensuring notable events remain attached to the workspace record.【F:backend/app/routers/activity.py†L17-L60】
- **Board layout preferences** – Column widths, grouping choices, and other layout preferences store per user under `/board-layouts`, backed by the `UserPreference` table.【F:backend/app/routers/preferences.py†L11-L39】
- **Saved filters** – Custom board filter definitions (including sharing flags) persist via `/filters` CRUD endpoints so queries survive browser resets.【F:backend/app/routers/filters.py†L12-L94】
- **Workspace catalogues** – Labels, statuses, and error categories are managed through `/labels`, `/statuses`, and `/error-categories`, keeping shared taxonomies in sync across the board.【F:backend/app/routers/labels.py†L16-L79】【F:backend/app/routers/statuses.py†L16-L79】【F:backend/app/routers/error_categories.py†L16-L99】

## Continuous Improvement & Analytics
- **Improvement initiatives** – `/initiatives` stores initiative definitions, progress logs, and linked cards so remediation efforts remain traceable.【F:backend/app/routers/initiatives.py†L17-L173】
- **Analytics snapshots & root-cause trees** – `/analytics` endpoints persist KPI snapshots, Why-Why analyses, and generated nodes that power the analytics dashboards.【F:backend/app/routers/analytics.py†L13-L370】
- **Suggested actions** – `/suggested-actions` tracks remediation proposals, status updates, and conversions into board cards while emitting audit activity.【F:backend/app/routers/suggested_actions.py†L13-L130】

## Reporting & AI Workflows
- **Status reports** – Drafting, updating, submitting, and retrying report analyses go through `/status-reports`, which records lifecycle events and AI output ties to cards.【F:backend/app/routers/status_reports.py†L14-L108】
- **Report templates & generated outputs** – Administrative `/reports` endpoints persist template catalogs, produced reports, and the analytics context embedded in each deliverable.【F:backend/app/routers/reports.py†L12-L200】
- **Appeal generation history** – `/appeals` stores generation requests and per-format results alongside subject metadata for compliance reviews.【F:backend/app/routers/appeals.py†L9-L30】

## Profile & Governance
- **Profile updates** – `/profile/me` persists nicknames, experience summaries, bios, and avatar uploads after validation and sanitisation.【F:backend/app/routers/profile.py†L19-L67】
- **API credentials & quota policies** – `/admin/api-credentials` and `/admin/quotas/*` endpoints encrypt provider keys, manage defaults, and capture override history for workspace limits.【F:backend/app/routers/admin_settings.py†L19-L140】
- **User privileges & per-user quotas** – `/admin/users` lets administrators toggle access rights and adjust individual AI quotas while recording overrides server-side.【F:backend/app/routers/admin_users.py†L18-L100】

## Competency Evaluations
- **Competency definitions & manual jobs** – `/admin/competencies` persists rubrics, criteria, and administrator-triggered evaluations with quota enforcement and audit logging.【F:backend/app/routers/competencies.py†L20-L200】
- **Self-service evaluations & history** – `/users/me/evaluations` and related endpoints allow members to run self-evaluations, review quotas, and browse their history while ensuring per-day limits are respected.【F:backend/app/routers/competency_evaluations.py†L22-L185】

## Related Documentation
- See [Persistence Detailed Design](../persistence-detail-design.md) for table-level schemas and migration strategy.
