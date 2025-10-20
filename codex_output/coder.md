Summary of changes
- Persist user linkage via userId; display nicknames on read.
- Remove SPA logic that overwrites assignee labels between nickname/email.
- Add a startup migration to normalize legacy assignee strings to userIds.

Backend changes
- File: backend/app/routers/cards.py
  - Added helpers:
    - _canonicalize_assignees: email/nickname/id → userId (unique, case-insensitive for email/nickname; preserves unmatched).
    - _canonicalize_single_assignee: single value version.
    - _resolve_display_names: userId → display label (nickname preferred, else email).
    - _card_read_with_display: build schemas.CardRead with nickname labels; also resolves subtask assignees.
  - list_cards: returns List[CardRead] with assignee and subtask assignee labels resolved to nicknames. Batched user lookups per response.
  - create_card: canonicalizes assignees on write; canonicalizes subtask.assignee; returns CardRead with nickname labels.
  - get_card: returns CardRead with nickname labels.
  - update_card: canonicalizes assignees on write when provided; returns CardRead with nickname labels.
  - Subtasks:
    - list_subtasks: returns List[SubtaskRead] with nickname-resolved assignee.
    - create_subtask/update_subtask: canonicalize assignee on write; return SubtaskRead with nickname label.

- File: backend/app/migrations.py
  - Added _normalize_assignees_to_user_ids(engine):
    - Reads users (id, email, nickname).
    - For cards.assignees (JSON array) and subtasks.assignee (string), replaces values with userId if matched by id, email (case-insensitive), or uniquely by nickname (case-insensitive). Leaves unmatched values unchanged.
  - Invoked _normalize_assignees_to_user_ids(engine) from run_startup_migrations.

Frontend changes (Angular)
- File: frontend/src/app/core/state/workspace-store.ts
  - Reworked syncDefaultAssigneeWithNicknameEffect:
    - Sets defaultAssignee from the active user’s nickname only.
    - Removed alias set and in-memory rewriting of card/subtask assignee labels (no more flipping between nickname and email).

What stayed the same
- API shapes remained unchanged. The same fields exist; only values now display nicknames resolved from userIds.
- Storage format for labels, statuses, etc. unchanged.

Verification steps
- Backend
  - Create a user U (email X, nickname N).
  - POST /cards with assignees ["X"].
    - DB stores ["U.id"]; response shows assignees ["N"].
  - PUT /cards/{id} with assignees ["N"].
    - DB stores ["U.id"]; response shows ["N"].
  - POST /cards/{id}/subtasks with assignee "X".
    - DB stores "U.id"; response shows "N".
  - GET /cards and GET /cards/{id} both show nickname labels; no flicker in the SPA.

- Migration
  - With legacy data: cards.assignees like ["someone@example.com", "unknown"], subtasks.assignee "Tester".
  - On startup, matching emails/nicknames convert to userIds; unmatched remain as-is.

Suggested commands (run locally)
- Backend tests: 
  - python -m venv .venv && source .venv/bin/activate
  - pip install -r requirements.txt
  - uvicorn backend.app.main:app or pytest -q (if tests are configured)
- Frontend sanity:
  - No API contract changes; just rebuild the SPA normally.

Open questions
- Filtering by assignee: current GET /cards?assignees= compares against stored values (now userIds). If the UI sends nicknames in filters, we should normalize inputs server-side; confirm expected client behavior.
- Status reports: StatusReportPresenter currently forwards card.assignees as stored values; these will be userIds post-change. If needed, we can add the same display-name resolution there.

Residual risks
- Ambiguous nicknames during migration (same nickname across users) are skipped to avoid incorrect mapping; those entries remain as legacy strings.
- Slight overhead per request to resolve userIds → nicknames; mitigated via per-request batching. If performance becomes a concern, add a request-scoped cache or prefetch.

Files touched
- backend/app/routers/cards.py: multiple focused additions; write canonicalization and read-time display resolution.
- backend/app/migrations.py: added _normalize_assignees_to_user_ids() and call from run_startup_migrations.
- frontend/src/app/core/state/workspace-store.ts: removed alias rewrite; nickname-only defaulting.

If you want, I can also update status report serialization to show nicknames for assignees in backend/app/services/status_report_presenter.py.