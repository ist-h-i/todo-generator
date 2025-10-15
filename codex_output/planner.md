**Approach**

Introduce a lightweight “Channel” model with membership and scope cards to a channel with minimal UI/API changes. Default every user to an auto-created private channel. Require a channel on card creation with a preselected default. Add simple invite/leave/kick actions with a minimal role model.

**Assumptions (to unblock work)**

- Cards associate directly to a `channel` (not via board). Boards remain as-is and continue to work; their views filter cards by the selected/current channel.
- Channel roles: `owner` and `member`. Owner can kick; any member can invite; invite auto-joins by username (no approval flow).
- Existing cards migrate to the creator’s private channel. Shared cards (if any) also migrate to the creator’s channel.
- New users get a private channel named “My Channel” at first login or user creation.
- Non-board modules are unaffected.

**Minimal Data Model**

- `channels(id, name, owner_user_id, is_private, created_at)`
- `channel_members(channel_id, user_id, role[owner|member], joined_at)` with unique(channel_id, user_id)
- Add `cards.channel_id` (non-null after backfill); index on `(channel_id)`

**API Changes (focused)**

- `GET /channels/mine` → list channels where caller is a member.
- `POST /cards` → require `channelId`; validate caller is member.
- Query endpoints that return cards must filter by channels the caller is member of (via `cards.channel_id IN (…member channels…)`).
- Membership actions:
  - `POST /channels/:id/invite { username }` → add member (any member can invite).
  - `POST /channels/:id/leave` → remove self if not owner with sole ownership (owner can leave if other owners or transfer out of scope for MVP).
  - `POST /channels/:id/kick { userId }` → owner only.

Optional for MVP: `GET /channels/:id` basic details (not required if UI uses `mine`).

**UI Changes (Angular, minimal)**

- Card create/edit dialog: add a `Channel` select fed by `GET /channels/mine`; preselect caller’s private channel; hide selector if only one channel.
- Card lists/boards views: add a lightweight channel filter/switcher (dropdown) at view level; default to last-used or private channel. If too costly, pass `channelId` via query params/state when navigating from the create dialog and default listing to “my channels” aggregation.
- Channel actions: simple menu in header/user menu:
  - “Invite to channel” (username input → call invite)
  - “Leave channel”
  - “Kick member” (owner-only: basic list with remove buttons or reuse existing member list UI if any)

**Migration Strategy**

- Create a private channel per user and membership(owner).
- Backfill: set `cards.channel_id` to the card creator’s private channel.
- Enforce NOT NULL on `cards.channel_id` post-backfill.
- Add read filters immediately; ensure old UI paths always pass/derive a valid `channelId`.

**Sequence (30-minute-fit, smallest diff)**

1) Migrations: create `channels`, `channel_members`, add `cards.channel_id`, backfill, add constraints/indexes.  
2) Backend: add membership check helpers; enforce channel scoping on card queries; require `channelId` on create; implement `GET /channels/mine` and membership actions.  
3) UI: add channel dropdown to card create dialog (default preselected); wire to `POST /cards`; add a simple channel filter for card lists or default to “all my channels”.  
4) Docs: brief notes in `docs/governance/development-governance-handbook.md` and `docs/guidelines/angular-coding-guidelines.md` about channel requirement for cards.  
5) Smoke tests: minimally cover card create with channel, filtered listing, invite/leave/kick.

**Critical Risks / Open Questions**

- Migration of already shared cards could change visibility unexpectedly; flagged as risk.
- Owner-leave edge cases (sole owner) need a policy; temporarily block leave if sole owner.
- Kicking the sole owner not allowed; owner transfer out-of-scope.
- Invitation by username assumes uniqueness and existing user; no email/link flow.
- Board-channel relationship remains implicit; boards show cards filtered by selected channel only, which may hide cards users expect. Consider a small banner explaining filters.

**Why this route fits 30 minutes**

- Adds the smallest new tables/columns and the narrowest API surface.
- UI impact limited to a dropdown and two simple actions.
- Invitations are immediate (no approval/notifications).

```json
{"steps":["coder","integrator"],"notes":"Coder implements minimal channel model, membership, card.channel_id, scoped queries, and small UI additions (channel select on card create, simple filter). Integrator runs migrations, wires config, and verifies endpoints/UI load. Owner/member role kept minimal; invites by username auto-join. Existing cards backfilled to creator’s private channel.","tests":"Backend: (1) Create card with invalid channel → 403. (2) Create card in member channel → 201, channelId stored. (3) List cards returns only member-channel cards. (4) Invite adds membership; invitee can list/create. (5) Leave removes membership; access revoked. (6) Kick by owner removes member; member loses access. UI: (1) Card create shows channel dropdown with default. (2) Creating a card without changing selection succeeds. (3) Switching channel filter changes visible cards. Migration: After migration, existing cards have non-null channel_id and are visible in private channel."}
```