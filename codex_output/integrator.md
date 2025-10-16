**Integration Summary**

- Models and migrations
  - `channels` and `channel_members` tables exist with relationships wired in `backend/app/models.py:256` and `backend/app/models.py:271`.
  - `cards.channel_id` added and related to `Channel` (`backend/app/models.py:123`, `backend/app/models.py:166`).
  - Startup migrations create channel tables, add `cards.channel_id`, and backfill private channels + memberships + card associations (`backend/app/migrations.py:296`, `backend/app/migrations.py:364`, `backend/app/migrations.py:392`, `backend/app/migrations.py:947`).
  - `run_startup_migrations` calls are in `backend/app/main.py` and run during app lifespan; ORM `create_all` follows to ensure schema.

- Routers and behavior
  - Channel endpoints implemented and registered:
    - `GET /channels/mine` (`backend/app/routers/channels.py:14`)
    - `POST /channels/{channel_id}/invite` by email (`backend/app/routers/channels.py:35`)
    - `POST /channels/{channel_id}/leave` with sole-owner guard (`backend/app/routers/channels.py:73`)
    - `POST /channels/{channel_id}/kick` owner-only (`backend/app/routers/channels.py:105`)
    - Router included in `backend/app/main.py:185`.
  - Card scoping by channel membership:
    - Helper `_member_channel_ids` (`backend/app/routers/cards.py:52`)
    - Query scoping via `_card_query(..., member_user_id=...)` for list/details/similar, etc. (calls at `backend/app/routers/cards.py:372`, `backend/app/routers/cards.py:551`, `backend/app/routers/cards.py:820`).
    - Card creation requires membership if `channel_id` provided; defaults to user’s private channel (`backend/app/routers/cards.py:491`–`511`).
  - Registration auto-creates a private channel + owner membership (`backend/app/routers/auth.py:60`–`63`).

- Schemas and docs
  - Card schemas include `channel_id` (`backend/app/schemas.py:283`, `backend/app/schemas.py:310`) and channel DTOs added (`backend/app/schemas.py:687`–`700`).
  - Docs updated to note channel model and card default channel (`docs/governance/development-governance-handbook.md:21`) and UI guidance for future selector (`docs/guidelines/angular-coding-guidelines.md:33`).

**Integrator Fix (MVP safety)**
- Block changing a card’s `channel_id` during update to avoid unauthorized or accidental cross-channel moves until policies/UI are defined.
  - Change: `backend/app/routers/cards.py:...` raises 409 if `channel_id` is present in update payload.

**Landing Plan**

- No extra ops steps: migrations run automatically at startup; ORM ensures tables.
- Start backend: `uvicorn app.main:app --reload --app-dir backend`
- Quick smoke checks (manual or via API client):
  - Register/login → ensure `GET /channels/mine` returns one private channel.
  - Create a card without `channel_id` → verify response includes `channel_id`.
  - List cards → only cards from member channels are returned.
  - Invite a second user via `/channels/{id}/invite` → login as invitee and confirm listing/creation works.
  - Attempt to update a card with `channel_id` change → expect 409.

**Residual Risks / Open Questions**

- Index: no explicit index on `cards.channel_id`; consider adding if listing grows.
- Invitation: email-based, assumes unique emails; no approval/notifications included.
- Sole-owner edge cases: owner cannot leave; ownership transfer is out of scope.
- Migration of pre-existing shared artifacts: all cards backfilled to creator’s private channel; visibility may narrow.
- Frontend: UI lacks a channel selector; backend defaults preserve current UX. Add selector later using `GET /channels/mine`.

**Follow-ups (minimal)**
- Add DB index for `cards.channel_id` when performance requires.
- Define and implement channel transfer policy (owner-only? audit?) and enable controlled channel updates.
- Add basic frontend dropdown for `Channel` in card creation with default selection; hide if only one channel.