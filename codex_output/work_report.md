## 背景
- Introduced “Channels” to team-scope boards while keeping non-board modules untouched.
- Each user gets a private channel; cards and subtasks are scoped by channel membership.
- Card creation now requires a channel (defaults to caller’s private channel to preserve UX).

## 変更概要
- Data model: Added `channels`, `channel_members`; added `cards.channel_id` (backfilled, enforced non-null), planned index on `cards.channel_id`.
- Migrations: Auto-create a private channel and owner membership per user; backfill existing cards to the creator’s private channel; idempotent startup hooks.
- Backend:
  - Scoped card queries to channels where caller is a member.
  - `POST /cards` requires membership; defaults to private channel when omitted.
  - Block changing `channel_id` on update (avoid uncontrolled moves).
  - Channels API: `GET /channels/mine`, `POST /channels/{id}/invite`, `POST /channels/{id}/leave`, `POST /channels/{id}/kick`.
  - On registration: auto-create private channel + owner membership.
- Schemas/Docs: Card DTOs include `channel_id`; lightweight docs note channel requirement.
- UI: No breaking change; channel selector deferred. Backend default preserves current flows.

## 影響
- Visibility: Users now see only cards in channels they belong to; prior implicit sharing may narrow.
- Permissions: Invite allowed for members; kick restricted to owner; sole owner cannot leave.
- API: Card reads/writes are channel-scoped; some calls may now return 403 if not a member.
- Compatibility: Creating cards without specifying `channel_id` still works (defaults applied).
- Performance: Channel filter adds a predicate; add `cards.channel_id` index if volume grows.

## 検証
- Channels
  - `GET /channels/mine` returns private channel after registration.
  - Invite adds membership; leave removes self (blocked if sole owner); kick works for owner.
- Cards
  - Create with invalid `channel_id` → 403; with member channel → 201 storing `channel_id`.
  - List endpoints return only member-channel cards.
  - Update with `channel_id` change → 409 (blocked).
- Migration
  - Existing users have private channels and memberships.
  - All existing cards have non-null `channel_id` pointing to creator’s private channel.

## レビュー観点
- Authorization coverage: Ensure every card/subtask endpoint uses channel membership checks.
- Owner edge cases: Sole owner leave policy; no owner transfer in MVP (acceptable?).
- Invitation flow: Email/username uniqueness and lack of approval—confirm product intent.
- Migration impact: Previously shared artifacts now private—confirm acceptable or flag exceptions.
- Indexing: Add/verify index on `cards.channel_id` for list performance.
- API contract: Frontend tolerance to added `channel_id` fields; no regressions without selector.
- Error semantics: Consistent 403/409 responses and idempotent membership endpoints.