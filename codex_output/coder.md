Summary
The nickname-first display rule is already implemented and wired through a shared helper. No additional code changes are required to meet the acceptance criteria with minimal impact.

What’s in place
- Shared helper for display name:
  - frontend/src/app/shared/utils/display-name.ts:1
  - Provides `getDisplayName({ nickname, email })` that trims values, prefers `nickname`, falls back to `email`.

- Shell header shows nickname first:
  - frontend/src/app/core/layout/shell/shell.ts:118 defines `displayName(user)` that delegates to `getDisplayName`.
  - frontend/src/app/core/layout/shell/shell.html:225 uses `{{ displayName(currentUser) }}` for the visible “name”. Email is still shown in metadata line, which is acceptable for contexts explicitly showing email.

- Workspace state and comments:
  - frontend/src/app/core/state/workspace-store.ts:742 computes `activeUserNickname` with `getDisplayName` to keep default-assignee and current-user naming in sync.
  - frontend/src/app/core/state/workspace-store.ts:749 `commentAuthorName` uses `getDisplayName(this.auth.user())`, falling back to ‘匿名ユーザー’ if not authenticated.
  - Comment lists display `comment.authorNickname` (from API); when creating comments locally, the prefill follows the same nickname-first rule via `commentAuthorName`.

- Admin/auth remain email-centric:
  - Admin user selection and user list present emails (e.g., frontend/src/app/features/admin/page.html:295, 321), aligned with “do not change explicitly email contexts.”
  - Auth pages use email fields only.

No changes needed
- The scoped helper exists and is used in the shell header and workspace store as planned.
- Behavior matches acceptance criteria, including whitespace-trim fallback and consistent use for current user display and comment author prefill.

Residual risks / open questions
- Comments from the API only include `author_nickname`/`author_id` (no `author_email`), so existing comments can’t fall back to email unless the backend adds it.
- Sorting/search policies by “name” are not adjusted; lists might still sort on email strings where present.
- Admin tables intentionally show email; confirm if there are any admin views that should display nickname alongside email.
- Edge case where a user’s nickname equals their email will display that value unchanged; confirm if alternate formatting is desired.

Commands to run
- None required. If you want me to run the frontend locally to verify visually, I can provide the steps, but dependency installation may require network access.