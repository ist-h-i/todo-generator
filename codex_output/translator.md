**Summary**
- Introduce “Channels” to team‑scope boards. Convert each user’s existing board workspace into their own private channel. Only board-related features live inside channels. Card creation must specify a channel. Members of a channel share visibility of cards and subtasks. Support inviting users to a channel and leaving/kicking from a channel.

**Objectives**
- Add a Channel concept with membership.
- Scope boards/cards/subtasks to a channel.
- Require channel selection on card creation.
- Enable invite, leave, and kick actions.

**Non‑Goals**
- Do not move non‑board features into channels.
- No broad refactors beyond what’s needed to support channels.

**Assumptions**
- Existing “board workspace” equals a per‑user area that maps 1:1 to a new private channel.
- Cards and subtasks already exist; we only add channel scoping.
- Minimal permission model is acceptable for MVP (e.g., owner/moderator).
- Existing cards can be automatically migrated to a user’s private channel.

**Constraints**
- Minimize diffs and UX disruption.
- Backward compatible where possible (e.g., default channel preselected).
- Complete within a small, incremental change set.
- No channelization of non‑board modules.

**Unknowns**
- Precise data model for channels and membership roles.
- How boards relate to channels (one channel → many boards, or cards directly in channels without boards?).
- Organization/tenant boundaries for channels.
- Invitation mechanism (username vs email) and approval flow.
- Who can kick whom; quorum rules (any member vs owner only).
- Default channel naming/visibility and discoverability.
- Migration details for shared cards across users.
- Moving cards between channels and audit implications.
- API and UI surfaces that must change (endpoints, forms, filters).

## Clarifying questions
- Should a channel contain multiple boards, or are cards directly associated to a channel independent of boards?
- Are channels scoped within an organization/team, or globally across the app?
- What roles exist in a channel (owner, admin, member), and who can invite/kick?
- How should invitations work (by username, email, link), and is acceptance required?
- Can cards be moved between channels? If yes, who is authorized to do so?
- How should existing shared boards/cards be migrated when multiple users currently see them?
- What is the default behavior for new users (auto‑create a private channel with a specific name)?
- Do we need UI filters/switchers for “current channel” across board/card views?
- Any auditing/notifications required for invites, joins, leaves, and kicks?
- Are there retention or access constraints for users removed from a channel (e.g., read‑only history)?