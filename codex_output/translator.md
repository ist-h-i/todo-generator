**Summary**
- Introduce “Channels” for team-scoped collaboration on boards.
- Each user’s current board workspace becomes their own private channel.
- Only board-related features live inside channels; other modules remain unchanged.
- Cards (and subtasks) are scoped to a channel; creating a card requires a channel.
- Members of a channel can see and collaborate on each other’s cards/subtasks.
- Users can invite others to a channel; members can leave, and owners (or defined role) can kick.

**Objectives**
- Add Channel concept with membership.
- Scope cards/subtasks and queries by channel membership.
- Require a channel on card creation (default to user’s private channel to preserve UX).
- Support invite, leave, and kick actions.

**Non-Goals**
- Do not move non-board features into channels.
- No broad refactors or complex role/permission system beyond MVP needs.
- No cross-channel card moves unless explicitly defined.
- No notification/audit system in this iteration.

**Assumptions**
- Existing “board workspace” maps 1:1 to a new private channel per user.
- Existing cards can be backfilled to each creator’s private channel.
- Minimal roles are acceptable (e.g., owner/member).
- Frontend can defer major UI changes by defaulting to the private channel.

**Constraints**
- Minimize diffs and limit impact on existing flows.
- Maintain backward compatibility where possible (default channel auto-selection).
- Deliver within a small, self-contained change set.
- Prefer idempotent, safe migrations; block changing `channel_id` on card update for now.

**Unknowns**
- Exact channel roles and permissions (who can invite/kick).
- Invitation method (username, email, link) and whether approval is required.
- Whether channels contain multiple boards or cards attach directly to channels.
- Tenant/organization scoping of channels.
- Policy on moving cards between channels and required auditing.
- Migration behavior for currently shared boards/cards across users.
- Required UI changes now vs later (channel selector/filter, member management).
- Any compliance/audit or notification requirements.

**Clarifying Questions**
- Should channels contain multiple boards, or do cards associate directly to a channel regardless of board?
- What roles are needed (owner/admin/member), and who can invite or kick?
- How do invitations work (username, email, shareable link), and is acceptance required?
- Are channels scoped within an organization/team or globally?
- Can cards be moved between channels? If yes, who is authorized and how is it audited?
- How should we migrate currently shared cards/boards where multiple users have access?
- What is the expected default for new users (auto-create private channel name/visibility)?
- Do we need a UI channel selector in card create/list now, or can we defer?
- Are notifications or audit logs required for invite/leave/kick events?
