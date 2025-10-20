**Summary**
- The backend now persists user linkage via userId and resolves assignee display names to nicknames on reads. The frontend removed the nickname/email overwrite logic and prefers nickname for defaults. A best‑effort migration normalizes legacy assignee strings to userIds at startup.

**What Looks Good**
- Write‑time canonicalization: email/nickname/id → userId
  - backend/app/routers/cards.py:105–156, 173–178 (_canonicalize_assignees/_canonicalize_single_assignee)
- Read‑time display: userId → nickname (fallback email)
  - backend/app/routers/cards.py:180–203 (_resolve_display_names)
  - Applied consistently in list/get/create/update cards and in subtask list/create/update:
    - list_cards: backend/app/routers/cards.py:492–520
    - create_card: backend/app/routers/cards.py:604–680
    - get_card: backend/app/routers/cards.py:689–699
    - update_card: backend/app/routers/cards.py:720–758
    - list_subtasks: backend/app/routers/cards.py:787–805
    - create_subtask: backend/app/routers/cards.py:829–842
    - update_subtask: backend/app/routers/cards.py:858–896
- Data model remains minimally invasive (strings remain, values now userIds):
  - backend/app/models.py:50–104 (Card.assignees JSON of strings)
  - backend/app/models.py:214–242 (Subtask.assignee string)
- Startup migration backfills legacy strings to userIds, preserving unmatched values:
  - backend/app/migrations.py:1000–1080 (_normalize_assignees_to_user_ids)
  - Invoked in run_startup_migrations: backend/app/migrations.py:1119–1140
- SPA stops label flipping and prefers nickname for default assignee:
  - frontend/src/app/core/state/workspace-store.ts:742–758, 780–816
- API shapes unchanged; Cards API and board rendering remain compatible:
  - frontend/src/app/core/api/cards-api.service.ts:139–171 (assignees typed as strings for display)

**Correctness & Edge Cases**
- Unique nickname handling during canonicalization and migration avoids ambiguity by skipping duplicates. Good.
- Read‑time resolution batches ids per response; avoids N+1. Good.
- Update and create paths canonicalize both card assignees and subtask assignee. Good.
- Filters: server‑side `assignees` query filters by stored values (now userIds). UI appears to filter client‑side; no current breakage spotted.

**Gaps / Risks**
- Status reports still emit raw stored assignee values (now userIds):
  - backend/app/services/status_report_presenter.py:63–92, 112–128
  - Impact: Status report cards may display userIds instead of nicknames.
- Display fallback might be empty when both nickname and email are empty:
  - backend/app/routers/cards.py:198–203 returns “” if email missing; consider falling back to userId for non‑empty display.
- Filtering by assignees via `GET /cards?assignees=` expects userIds now. If any external caller sends emails/nicknames, results will differ. The SPA doesn’t use this param currently, but integrations might.
- Migration ambiguity: duplicate nicknames are skipped by design; those records remain as legacy strings until updated. Acceptable, but consider logging count for observability.

**Lightweight Fixes (recommended)**
- Resolve assignee display names in status report serialization (mirrors cards router):
  - In backend/app/services/status_report_presenter.py, batch map card.assignees and subtask.assignee via `object_session` to nickname/email.
  - Sketch:
    - Import: `from sqlalchemy.orm import object_session`
    - Collect `user_ids` from linked cards/subtasks; query users; build map like `_resolve_display_names`.
    - Replace assignees/subtasks in `serialize_card_link` similar to `_card_read_with_display`.
- Improve fallback in display resolution:
  - backend/app/routers/cards.py:198–203: if neither nickname nor email is present, fall back to `user.id`.

**Performance**
- Per‑request batching for id→name is used; good. If usage grows, consider request‑scoped caching to avoid repeat mapping across multiple endpoints in the same request (optional).

**Tests/Verification**
- Existing tests don’t assert assignee display content; they should still pass.
- Add/extend tests to cover:
  - Create with email → GET returns nickname
  - Create with nickname → GET returns nickname
  - Subtask assignee resolution
  - Migration path with legacy email in `cards.assignees` and `subtasks.assignee`
  - Optional: status report card summaries reflect nicknames after the above fix

**Open Questions**
- Should `GET /status-reports/*` display nicknames for assignees consistently with cards?
- Should `GET /cards?assignees=` accept email/nickname inputs and canonicalize to userIds for filtering (backward compatibility)?
- What is the desired display when a user is deleted/disabled? Current behavior: label remains raw stored value.

**Residual Risks**
- Unmatched legacy values remain as strings post‑migration; they’ll display as‑is until edited.
- Status report UX inconsistency (userIds visible) until presenter is updated.
- External integrations filtering by email/nickname may break if they rely on `assignees` query semantics.