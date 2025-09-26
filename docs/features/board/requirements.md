# Board Collaboration Requirements

## Document Control
| Field | Value |
| --- | --- |
| Version | 0.10 |
| Author | Product Enablement |
| Last Updated | 2024-07-09 |
| Status | Draft |

## 1. Background & Objectives
The workspace board gives teams a shared view of task progress, quick filtering tools, and inline collaboration through comments and activity history. The experience is powered by Angular signals that keep columns, filters, and card details synchronized with persisted workspace preferences and backend audit logs.【F:frontend/src/app/features/board/page.ts†L48-L215】【F:frontend/src/app/core/state/workspace-store.ts†L360-L520】【F:backend/app/routers/activity.py†L1-L60】

### Objectives
1. Enable drag-and-drop planning for tasks and subtasks so teams can rebalance workloads with minimal clicks.【F:frontend/src/app/features/board/page.ts†L315-L368】【F:frontend/src/app/core/state/workspace-store.ts†L632-L720】
2. Provide multi-dimensional filtering (search, labels, statuses, quick filters) that persists per user and keeps card and subtask views in sync.【F:frontend/src/app/features/board/page.ts†L210-L276】【F:frontend/src/app/core/state/workspace-store.ts†L480-L632】
3. Support threaded collaboration through comment timelines and activity logs with permission-aware APIs for auditability.【F:frontend/src/app/features/board/page.ts†L402-L525】【F:backend/app/routers/comments.py†L1-L82】【F:backend/app/routers/activity.py†L14-L60】

## 2. Scope
### In Scope
- Task board UI for cards grouped by status or label with subtask swimlanes and drag-and-drop interactions.【F:frontend/src/app/features/board/page.html†L58-L182】【F:frontend/src/app/features/board/page.ts†L301-L368】
- Board filters, search box, quick filters, and persistence of preferences per authenticated user.【F:frontend/src/app/features/board/page.html†L16-L89】【F:frontend/src/app/core/state/workspace-store.ts†L520-L632】
- Card detail drawer covering metadata editing, subtasks, comments, and activity timeline display.【F:frontend/src/app/features/board/page.html†L184-L540】【F:frontend/src/app/features/board/page.ts†L368-L525】
- Backend comment creation/deletion and activity log APIs that honor workspace ownership and actor context.【F:backend/app/routers/comments.py†L14-L82】【F:backend/app/routers/activity.py†L16-L60】
- Default AI-assisted template flow for one-off card creation that proposes labels, statuses, and metadata before saving.

### Out of Scope
- Real-time multi-user presence indicators (future enhancement).
- External notification channels (email, chat) triggered from board actions.
- Role administration beyond the existing owner/actor checks in current routers.

## 3. Personas
| Persona | Goals | Key Needs |
| --- | --- | --- |
| Product Owner | Track delivery risk and rebalance work quickly | Accurate drag-and-drop updates and filters showing at-risk items |
| Tech Lead | Coach engineers and manage review flow | Visibility into subtasks, comment history, and activity logs |
| Project Coordinator | Prepare status updates for stakeholders | Exportable views with reliable audit trails and persisted filters |

## 4. User Stories & Acceptance Criteria
1. **Plan work with drag-and-drop** – As a product owner, I move cards across status columns to reassign work.
   - When grouping by status, dragging a card into a new column updates its status immediately and reflects the status accent color in the card preview.【F:frontend/src/app/features/board/page.ts†L321-L368】【F:frontend/src/app/core/state/workspace-store.ts†L664-L720】
   - Dragging is disabled when grouping by label to prevent accidental status changes.【F:frontend/src/app/features/board/page.html†L118-L160】
   - Subtasks dragged between swimlanes update their status while keeping parent card references intact.【F:frontend/src/app/features/board/page.ts†L335-L368】【F:frontend/src/app/core/state/workspace-store.ts†L700-L720】

2. **Narrow focus with filters** – As a tech lead, I combine search, label, and quick filters to identify blockers.
   - Search terms match against card titles and summaries regardless of casing and update the badge summary in the header.【F:frontend/src/app/features/board/page.ts†L210-L276】【F:frontend/src/app/core/state/workspace-store.ts†L520-L608】
   - Selecting filters persists to local storage per user and restores on reload.【F:frontend/src/app/core/state/workspace-store.ts†L36-L116】【F:frontend/src/app/core/state/workspace-store.ts†L520-L632】
   - Quick filters for assignments, due dates, recent work, and high priority stack together and restrict board columns and subtask lanes consistently.【F:frontend/src/app/features/board/page.ts†L210-L276】【F:frontend/src/app/core/state/workspace-store.ts†L520-L608】

3. **Collaborate with comments** – As a team member, I log decisions on cards and manage comment timelines.
   - Comment form validates author and message, saving entries with timestamps and resetting message input after submission.【F:frontend/src/app/features/board/page.ts†L239-L324】【F:frontend/src/app/core/state/workspace-store.ts†L720-L808】
   - Comment list shows author, last updated time, and delete controls per entry; empty states display helper text.【F:frontend/src/app/features/board/page.html†L486-L540】
   - Deleting a comment updates the timeline immediately and records an activity log entry for audit trails.【F:frontend/src/app/core/state/workspace-store.ts†L792-L824】【F:backend/app/routers/comments.py†L60-L82】

4. **Review activity history** – As a coordinator, I audit recent actions across the workspace.
   - Activity API returns the latest events scoped to cards owned by the current user or actions performed by them.【F:backend/app/routers/activity.py†L16-L44】
   - Manual activity entries persist via `POST /activity-log` and reuse the same ownership checks before saving.【F:backend/app/routers/activity.py†L46-L60】
   - Card and comment mutations emit activity events with structured detail payloads for traceability.【F:backend/app/routers/comments.py†L40-L79】【F:backend/app/routers/cards.py†L360-L600】

5. **Respect permissions** – As an authenticated user, I only see and mutate data for cards I own.
   - Comment endpoints validate that the card belongs to the current user before listing, creating, or deleting comments.【F:backend/app/routers/comments.py†L16-L82】
   - Activity listing verifies ownership of the card when filtering by `card_id` and blocks access otherwise.【F:backend/app/routers/activity.py†L28-L44】
   - Workspace store initializes from authenticated preferences and keeps selections scoped to the signed-in profile only.【F:frontend/src/app/core/state/workspace-store.ts†L60-L120】【F:frontend/src/app/core/state/workspace-store.ts†L440-L520】

6. **Create a guided default card** – As a project coordinator, I sometimes need to capture a single card quickly without choosing from the template library.
   - A "Default AI suggestion" option appears alongside existing templates and is limited to creating one card at a time.
   - Selecting the default option triggers AI-generated suggestions for labels, status, assignee, and other metadata, which users can review and override before saving.
   - The chosen AI recommendations are persisted with the card and logged in activity history to document automated assistance.

## 5. Functional Requirements
1. Persist workspace settings and filters to browser storage namespaced by user IDs and migrate legacy keys automatically.【F:frontend/src/app/core/state/workspace-store.ts†L24-L120】
2. Compute board columns dynamically based on grouping mode and filtered card IDs, including counts and accent colors per column.【F:frontend/src/app/core/state/workspace-store.ts†L520-L608】
3. Highlight selected cards and subtasks to align board and subtask swimlanes, resetting forms when selection changes.【F:frontend/src/app/features/board/page.ts†L368-L460】
4. Support inline card editing (title, summary, status, priority, assignee, story points) with validation and diff detection to avoid unnecessary writes.【F:frontend/src/app/features/board/page.ts†L178-L320】【F:frontend/src/app/core/state/workspace-store.ts†L808-L872】
5. Manage subtasks with add, update, delete, and status change operations, ensuring data normalization and numeric validation for estimates.【F:frontend/src/app/features/board/page.ts†L324-L452】【F:frontend/src/app/core/state/workspace-store.ts†L632-L760】【F:frontend/src/app/core/state/workspace-store.ts†L824-L912】
6. Provide an AI-assisted default template pathway that (a) pre-fills recommended metadata, (b) limits creation scope to a single card, (c) surfaces confidence levels or rationales, and (d) records acceptance or overrides within activity logs.

## 6. Non-Functional Requirements
- **Performance** – Filtered card computations rely on pure signal transformations to minimize change detection work and keep board interactions under 50 ms for typical datasets.【F:frontend/src/app/core/state/workspace-store.ts†L480-L608】
- **Reliability** – Activity logging happens within database transactions to guarantee comment or card mutations are accompanied by audit records.【F:backend/app/routers/comments.py†L40-L79】【F:backend/app/routers/cards.py†L360-L600】
- **Usability** – Drag handles, disabled states, and badges provide context for grouping and filter states, ensuring discoverability of board controls.【F:frontend/src/app/features/board/page.html†L16-L182】
- **Security & Privacy** – Backend routers check authenticated ownership on every request, and the frontend store normalizes user-provided strings before persisting.【F:backend/app/routers/comments.py†L14-L82】【F:frontend/src/app/core/state/workspace-store.ts†L700-L808】

## 7. Success Metrics
| Metric | Target | Measurement |
| --- | --- | --- |
| Drag-and-drop adoption | 80% of board status changes recorded via `card_updated` activity entries | Count `card_updated` actions in `activity_log` table and compare to direct status edits.【F:backend/app/routers/cards.py†L420-L470】【F:backend/app/routers/activity.py†L46-L60】 |
| Filter engagement | 60% of active users have non-default quick filters saved in preferences | Analyze persisted filter payloads under `workspace-preferences` storage namespace.【F:frontend/src/app/core/state/workspace-store.ts†L24-L120】【F:frontend/src/app/core/state/workspace-store.ts†L520-L632】 |
| Comment collaboration | Average of ≥2 comments per active card per week | Track comment counts per card via `/comments/` list endpoint filtered by owner.【F:backend/app/routers/comments.py†L16-L44】 |
| Audit completeness | 100% of comment mutations emit `comment_created` or `comment_deleted` activity events | Validate `activity_log` entries after comment API calls during QA automation.【F:backend/app/routers/comments.py†L40-L82】 |
| AI template adoption | 50% of ad-hoc card creations use the AI default template with at least one suggestion accepted | Measure `/cards` create events flagged with the AI default template identifier and compare accepted vs. overridden fields. |

## 8. Open Questions
- Should drag-and-drop status changes trigger notifications or remain silent beyond the activity log?
- Do we need to surface activity filters (e.g., by action type) on the board page or dedicated history view?
- How should we reconcile external collaborators without workspace ownership when introducing shared boards?
