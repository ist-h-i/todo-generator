**背景**
- Requirement: Prefer nickname over email wherever a user “name” is shown; fall back to email only when nickname is missing or whitespace.
- Scope: Presentation layer only; do not alter admin/auth screens that explicitly show email; maintain i18n/a11y.

**変更概要**
- Shared helper centralizes display-name logic:
  - `frontend/src/app/shared/utils/display-name.ts:1` provides `getDisplayName({ nickname, email })` (trim, prefer nickname, else email).
- Shell header uses the helper:
  - `frontend/src/app/core/layout/shell/shell.ts:118` exposes `displayName(user)` delegating to `getDisplayName`.
  - `frontend/src/app/core/layout/shell/shell.html:225` renders `{{ displayName(currentUser) }}`; email remains in the metadata line.
- Workspace store aligns current-user naming:
  - `frontend/src/app/core/state/workspace-store.ts:742` normalizes active user nickname.
  - `frontend/src/app/core/state/workspace-store.ts:749` computes `commentAuthorName` via `getDisplayName(this.auth.user())`, falling back to ‘匿名ユーザー’ when unauthenticated.
- Admin/auth remain email-centric (no change), e.g., `frontend/src/app/features/admin/page.html:304`.

**影響**
- User-facing “name” displays now consistently show nickname when present; whitespace-only nicknames fall back to email.
- Comments list shows `authorNickname` from API; legacy comments without nickname fall back to author_id per existing mapping.
- No backend/schema changes; no API or routing changes; minimal UI surface change (text value only).

**検証**
- Header: nickname='Hanako', email='hanako@example.com' → shows “Hanako”.
- Header: nickname='   ', email='hanako@example.com' → shows “hanako@example.com”.
- Header: nickname null/undefined, email present → shows email.
- Comments composer prefill matches the same rule; unauthenticated shows ‘匿名ユーザー’.
- Admin Users and auth forms still display email only; no regressions in those contexts.

**レビュー観点**
- Consistency: Confirm no other user-facing views bypass the helper when showing a “name”; promote `getDisplayName` for future use.
- Intentional email contexts: Ensure admin/security/notifications still show emails as designed.
- Sorting/search: If any lists sort/filter by “name,” should nickname be the primary key? Current work does not change sorting semantics.
- Edge cases: Nickname identical to email will display that same value; confirm if alternate formatting is desired.
- Data limits: Comments from API include `author_nickname` but not `author_email`; older comments cannot fall back to email unless backend adds it.

残課題・リスク（明示）
- Bypass risk if future components read `user.nickname` directly instead of `getDisplayName`.
- Comments fallback limited by API fields; email-based fallback not possible for historical comments.
- Potential ambiguity where email is expected for disambiguation in support/admin contexts; verify UX expectations per screen.