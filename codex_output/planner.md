Plan Summary
- Replace assignee strings with stable userId at persistence time; resolve to nickname only at read time.
- Remove nickname/email “overwrite” logic in the SPA to stop flipping labels.
- Keep API shapes unchanged to minimize impact; perform mapping inside routers/services.
- Provide a safe startup backfill that maps existing assignees from email/nickname → userId where possible.

What to change (minimum scope)
- Backend
  - Cards/Subtasks write path: When receiving `assignees` (cards) or `assignee` (subtasks), canonicalize each entry to `userId` if it matches a user.id, user.email, or user.nickname. Store userIds going forward; leave unmatched values as-is to preserve data.
  - Cards/Subtasks read path: Before returning responses for list/get/create/update, resolve display labels by mapping stored userIds to nicknames (fallback to email, then raw value). Return the label strings (nickname) in the existing `assignees`/`assignee` fields so the SPA keeps working without contract changes.
  - Status reports: In the presenter, resolve `card.assignees` to nickname labels when serializing report card summaries (if feasible in 30 minutes); otherwise call out as follow-up risk.
  - Migration: Add a startup migration step that scans `cards.assignees` and `subtasks.assignee` and replaces emails/nicknames with userIds when a unique match is found. Skip on ambiguity.
- Frontend (Angular)
  - Remove/disable the WorkspaceStore effect that overwrites assignee labels between nickname and email. If keeping defaulting, prefer nickname-only (no email fallback) to avoid regressions when nickname is missing.

Why this fits the 30-minute cap
- No API surface changes; all transformations happen server-side within existing endpoints.
- Thin, localized edits: cards router (create/update/list/get), subtasks endpoints, one presenter method, one Angular store effect.
- Backfill is optional-safe and batched; skips on ambiguity.

Open questions
- Exact fallback for unresolved userId at read-time: show raw value or a placeholder (“Unassigned”)? Proposal: show raw value to avoid data loss; “Unassigned” only when field empty.
- Multiple assignees usage in UI: SPA currently displays a single `assignee`; we’ll continue using the first resolved nickname from the backend’s list.
- Reports: If presenter cannot easily resolve nicknames without a session, short-term they may show raw ids. OK to defer?
- Do we need to support searching/filtering by assignee nickname vs userId in `GET /cards`? Currently filters use strings; with server-side resolution to nickname for display only, the filter semantics may need review.

Residual risks
- Legacy records with emails/nicknames that do not match a user won’t be normalized; those will display as-is.
- Performance: resolving nicknames could add DB lookups; mitigate by batching per response and caching within request scope.
- Reports may still show ids if not updated; small UX inconsistency until addressed.
- Any external integrations expecting email in `assignees` may be impacted; we’re returning nicknames for display.

Acceptance alignment
- Persist links via userId; display nickname resolved from userId.
- Remove front-end logic that overwrites nickname/email labels.
- Provide a safe, best-effort migration from legacy strings to userIds.
- Maintain backward compatibility by keeping response fields stable and providing graceful fallbacks.

Proposed tasks (coder)
- Backend
  - Add helper: canonicalize-assignees (email/nickname/id → id) with DB lookups; batch resolvers for id→display-name.
  - Cards router: apply canonicalization on create/update; resolve display names on list/get before returning.
  - Subtasks router: apply canonicalization on create/update; resolve display names on list/get.
  - Status report presenter: resolve `assignees` to nicknames if feasible.
  - Migration: add `_normalize_assignees_to_user_ids(engine)` in `migrations.py` and call from `run_startup_migrations`.
- Frontend
  - Remove `syncDefaultAssigneeWithNicknameEffect` alias-rewrite behavior; optionally prefer nickname-only when setting defaultAssignee.

Verification steps
- Create card with `assignees = ['user@example.com']` → Persistence stores `userId`; GET returns `assignees = ['Nickname']`.
- Update card with `assignees = ['Nickname']` → stores `userId`; GET returns same nickname.
- Create/update subtask assignee with email/nickname → stores `userId`; GET returns nickname.
- Existing cards with email in assignees get normalized on startup when user exists; GET returns nickname. Unmatched remain unchanged.
- SPA no longer flips labels between nickname/email on load; board and detail views show consistent nicknames.
- Optional: Report detail page shows nicknames for linked cards’ `assignees` (if presenter updated).

```json
{"steps":["coder","code_quality_reviewer"],"notes":"Implement server-side canonicalization (email/nickname/id→userId) on writes and nickname resolution on reads for cards/subtasks; keep API shapes unchanged. Add a startup backfill to convert legacy values when possible. Remove SPA effect that rewrites assignee labels between nickname/email to avoid toggling; optionally prefer nickname-only for defaultAssignee. Batch/cached lookups to avoid performance regressions. Reports presenter update is desirable but may be deferred if time is tight.","tests":"1) Backend: Create user A (email X, nickname N). POST /cards with assignees [X] → DB stores [A.id]; GET /cards returns assignees [N]. 2) Update card with assignees [N] → DB stores [A.id]; GET returns [N]. 3) Subtask: POST /cards/{id}/subtasks with assignee X → DB stores A.id; GET returns assignee N. 4) Migration: Insert legacy records with assignees ['X','unknown']; run app; verify 'X' becomes A.id while 'unknown' remains. 5) Frontend: Load board with a card assigned to A; verify label shows N and no flicker/overwrite to email; change profile nickname and reload—labels stay consistent (backend resolves on read). 6) Optional: Reports page shows nicknames for assignees if presenter updated; otherwise document as follow-up."}
```