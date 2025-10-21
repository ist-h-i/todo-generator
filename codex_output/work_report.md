**背景**
- Introduced “Channels” for team-scoped collaboration while keeping non-board modules untouched.
- Each user has a private channel; cards and subtasks are visible to channel members.
- Card creation now requires a channel; default is the caller’s private channel to preserve UX.

**変更概要**
- Data model: Added `channels` and `channel_members`; added `cards.channel_id` (backfilled; intended non-null), with a future index on `cards.channel_id`.
- Migrations: Idempotent startup creates private channels and owner memberships per user; backfills existing cards to creators’ private channels.
- Backend:
  - Scoped all card/subtask queries and mutations to channels where caller is a member.
  - `POST /cards` requires membership; defaults to private channel if omitted.
  - Block changing `channel_id` on update (409) to prevent uncontrolled cross-channel moves.
  - Channels API: `GET /channels/mine`, `POST /channels/{id}/invite`, `POST /channels/{id}/leave`, `POST /channels/{id}/kick`.
  - On registration: auto-create private channel + owner membership.
- Schemas/Docs: Card DTOs include `channel_id`; brief docs note channel requirement and defaults.
- UI: No breaking changes; channel selector deferred to minimize scope.

**影響**
- Visibility: Users now see only cards in channels they belong to; prior implicit sharing may narrow.
- Permissions: Any member can invite; kick is owner-only; sole owner cannot leave.
- API semantics: Some endpoints may return 403 (not a member) or 409 (channel move blocked).
- Performance: Additional channel filter predicate; add index on `cards.channel_id` when needed.

**検証**
- Channels
  - `GET /channels/mine` returns the private channel after registration.
  - Invite adds membership; leave removes self (blocked if sole owner); kick works for owner.
- Cards
  - Create without `channel_id` → 201 with default private channel; response includes `channel_id`.
  - Create with non-member `channel_id` → 403.
  - List endpoints return only cards from member channels.
  - Update with `channel_id` present → 409.
- Subtasks
  - Non-owner channel members can update/delete subtasks on member-channel cards.
- Migration
  - Existing users have private channels and memberships.
  - All existing cards have non-null `channel_id` pointing to the creator’s private channel (post-backfill).

**レビュー観点**
- Authorization coverage: Confirm every card/subtask endpoint enforces channel membership.
- Ownership edge cases: Sole-owner leave policy and future owner transfer.
- Invitation flow: Identifier (email/username), uniqueness, and lack of approval—align with product intent.
- Migration impact: Previously shared artifacts potentially narrowed—confirm acceptability or exceptions.
- Indexing: Add/verify `cards.channel_id` index for list performance at scale.
- API/UI contract: Frontend tolerance to added `channel_id`; timing for a minimal channel selector.