**Scope**
Adds a minimal “Channel” concept to backend with membership and scopes cards to channels while preserving existing UX. Cards default to the user’s private channel if not specified. UI is unchanged for now to minimize diffs.

**Backend Changes**
- Models
  - Added `Channel` and `ChannelMember` and linked to cards.
    - `backend/app/models.py:115` Card gains `channel_id` FK and relationship; `backend/app/models.py:256` new `Channel`; `backend/app/models.py:272` new `ChannelMember`.
- Migrations
  - Startup migrations create channel tables (idempotent), add `cards.channel_id`, create a private channel per user with membership, and backfill existing cards.
    - Ensure tables: `backend/app/migrations.py:296`
    - Add `cards.channel_id`: `backend/app/migrations.py:364`
    - Backfill + ensure memberships: `backend/app/migrations.py:392`
    - Hooked into startup: `backend/app/migrations.py:740` (append calls to the end of `run_startup_migrations`)
- Auth (new users)
  - On registration, auto-create private channel and owner membership.
    - `backend/app/routers/auth.py:...` after `ensure_default_workspace_template` add `Channel` and `ChannelMember` inserts.
- Cards router (scoping + creation)
  - Card queries filter by channels the current user is a member of.
  - New cards require channel membership if `channel_id` is provided; otherwise default to caller’s private channel.
  - All card/subtask access gates migrated from strict owner to “accessible via channel membership.”
    - Member channel IDs helper: `backend/app/routers/cards.py:52`
    - `_card_query` updated: `backend/app/routers/cards.py:61`
    - Accessor `_get_accessible_card`: `backend/app/routers/cards.py:260`
    - Apply scoping to list/detail/update/delete/subtasks/similar/feedback paths accordingly (multiple blocks updated within the file).
- Channels router (minimal MVP)
  - `GET /channels/mine` → list channels where caller is member.
  - `POST /channels/:id/invite { email }` → add a user to channel (any member can invite).
  - `POST /channels/:id/leave` → leave channel (block if sole owner).
  - `POST /channels/:id/kick { user_id }` → owner-only.
    - `backend/app/routers/channels.py:1`
  - Router registered in app: `backend/app/main.py` added import and `app.include_router`.
- Schemas
  - Cards: add `channel_id` to `CardBase`, `CardCreate`, `CardUpdate`, `CardRead`.
    - `backend/app/schemas.py:...` (Card sections)
  - Channels: add `ChannelRead`, `ChannelInviteRequest`, `ChannelKickRequest`.
    - `backend/app/schemas.py:...` (towards end of file after status report detail)

**Documentation**
- Governance notes on channel tables and card channel default:
  - `docs/governance/development-governance-handbook.md` (Python & Backend Practices section)
- Angular guidelines note for future channel selector:
  - `docs/guidelines/angular-coding-guidelines.md` (State Management & Data Flow section)

**New Endpoints**
- `GET /channels/mine` → list member channels
- `POST /channels/{channel_id}/invite { email }`
- `POST /channels/{channel_id}/leave`
- `POST /channels/{channel_id}/kick { user_id }`

**Behavior Summary**
- On startup: create `channels`, `channel_members` (if `users` exists), add `cards.channel_id`, create private channels for existing users, backfill existing cards to those channels.
- On registration: create private channel and grant owner membership to the user.
- Listing/accessing cards: now shows cards in channels the user is a member of (includes the user’s private channel).
- Creating cards: accepts optional `channel_id` (must be a member). If omitted, defaults to caller’s private channel.
- Non-board modules unaffected.

**Commands**
- Backend dev server (runs migrations automatically):
  - `uvicorn app.main:app --reload --app-dir backend`
- Backend tests:
  - `pytest backend/tests`
- Lint/format (optional):
  - `ruff check backend`
  - `black --check backend/app backend/tests`

**Residual Risks / Open Questions**
- Owner leave flow is blocked for sole owners; ownership transfer is out of scope.
- No UI channel selector yet; backend defaults preserve UX but not explicit selection. OK for MVP; can add dropdown fed by `GET /channels/mine`.
- Invitation by email assumes unique user emails and immediate membership without approval.
- Cards created before this change are backfilled to private channels of their owners; any prior “shared” semantics are not preserved (if they existed).
- No card “move channel” endpoint; consider later if needed.

**Next Steps (optional, minimal UI)**
- Add `channelId` field in `CardCreateRequest` (frontend) and a dropdown in create flows:
  - Use `GET /channels/mine`, preselect private channel, hide control if only one.
  - Defer to keep changes minimal now.