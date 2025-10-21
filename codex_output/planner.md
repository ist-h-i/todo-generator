**Plan Overview**
- Implement minimal Channels: tables, membership, and `cards.channel_id`.
- Scope all card/subtask reads/writes by channel membership.
- Default card creation to caller’s private channel; block `channel_id` changes on update.
- Add minimal endpoints: `GET /channels/mine`, `POST /channels/{id}/invite|leave|kick`.
- Idempotent startup migrations: create private channels per user and backfill existing cards.

**Why This Route**
- Smallest diff to meet requirements; no frontend refactor needed now.
- Preserves current UX by defaulting to private channel.
- Avoids broad permission refactors; simple owner/member model.

**Deliverables**
- Backend models, migrations, and routers for channels and membership.
- Scoped queries and create/update guards for cards/subtasks.
- Brief docs note on channel requirement and defaults.

**Critical Risks / Open Questions**
- Migration may reduce visibility of previously shared cards.
- Sole owner cannot leave; ownership transfer deferred.
- Invite by unique username/email without approval; confirm product intent.
- No cross-channel moves yet; audit policy TBD.
- Consider index on `cards.channel_id` if lists grow.

```json
{"steps":["coder","integrator"],"notes":"Coder adds Channel + ChannelMember, cards.channel_id, membership-scoped queries, default channel on card create, and invite/leave/kick endpoints; blocks channel_id changes. Integrator wires startup migrations to create private channels per user and backfill cards, registers routers, and verifies endpoints. Frontend selector deferred to keep scope minimal.","tests":"Backend: (1) GET /channels/mine returns private channel after registration. (2) POST /cards without channel_id creates in private channel; response includes channel_id. (3) POST /cards with non-member channel → 403. (4) List cards only returns member-channel cards. (5) Attempt to update card with channel_id → 409. (6) Invite user → invitee can list/create in channel. (7) Leave removes membership; access revoked. (8) Kick by owner removes member; access revoked. Migration: existing users have private channels; existing cards have non-null channel_id pointing to creator’s channel."}
```
