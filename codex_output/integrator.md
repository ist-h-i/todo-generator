**Integration Summary**

- Channels model, membership, and card scoping are fully wired across models, migrations, routers, and schemas.
- Startup migrations create channel tables, backfill private channels/memberships, and set `cards.channel_id`; backend enforces channel membership on reads/writes.
- New users auto‑receive a private channel; card creation defaults to it if no channel is specified.

**What I Verified**

- Models
  - `Card.channel_id` FK to channels: backend/app/models.py:123
  - `Channel` and `ChannelMember` with relationships: backend/app/models.py:257, backend/app/models.py:272
- Migrations
  - Create `channels`/`channel_members`: backend/app/migrations.py:302
  - Add `cards.channel_id`: backend/app/migrations.py:371
  - Backfill private channels + memberships + card channel: backend/app/migrations.py:392
  - Wired in startup sequence: backend/app/migrations.py:947
- Routers
  - Channels API: mine/invite/leave/kick: backend/app/routers/channels.py:11, backend/app/routers/channels.py:35, backend/app/routers/channels.py:73, backend/app/routers/channels.py:105
  - Cards scoped to member channels: backend/app/routers/cards.py:52, backend/app/routers/cards.py:71
  - Create card requires membership or defaults to private channel: backend/app/routers/cards.py:491, backend/app/routers/cards.py:498
  - Updating `channel_id` is blocked (MVP safety): backend/app/routers/cards.py:570
  - Subtasks authorized via channel membership: backend/app/routers/cards.py:685, backend/app/routers/cards.py:734
  - Router inclusion: backend/app/main.py:185
- Auth
  - Registration auto-creates private channel + owner membership: backend/app/routers/auth.py:60, backend/app/routers/auth.py:63
- Schemas/Docs
  - Card DTOs include `channel_id`; channel DTOs present: backend/app/schemas.py:283, backend/app/schemas.py:310, backend/app/schemas.py:695
  - Docs note channels + default behavior: docs/governance/development-governance-handbook.md:21, docs/guidelines/angular-coding-guidelines.md:33

**Behavioral Outcomes**

- Reads and writes are limited to channels where the caller is a member.
- Card creation without `channel_id` succeeds and stores the private channel.
- Attempting to move a card across channels via update returns 409.
- Members can invite; owners can kick; sole owner cannot leave.

**Residual Risks / Follow‑ups**

- `cards.channel_id` is nullable (by design for safe migration). Optionally enforce NOT NULL later.
- No DB index on `cards.channel_id`; add if list queries grow.
- Invitation uses email and auto‑joins; no approval/notifications yet.
- No cross‑channel move policy (explicitly blocked).

**Verification Steps**

- Start backend: `uvicorn app.main:app --reload --app-dir backend`
- Channels
  - `GET /channels/mine` returns private channel after register.
  - `POST /channels/{id}/invite { email }` adds member; `leave` removes; `kick` owner‑only.
- Cards
  - `POST /cards` without `channel_id` → created with private channel; response has `channel_id`.
  - `POST /cards` with non‑member `channel_id` → 403.
  - `GET /cards` only returns member‑channel cards.
  - `PUT /cards/{id}` with `channel_id` → 409.
- Subtasks
  - As non‑owner member, `PUT`/`DELETE` subtask on a member‑channel card succeeds.
