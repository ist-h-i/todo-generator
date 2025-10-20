Plan summary
- Centralize “display name” logic in a small shared utility.
- Use it in the shell header so nickname (trimmed) is preferred over email.
- Keep scope tight; avoid changes to admin/auth contexts and backend.

Proposed changes (30 min scope)
- Add `getDisplayName(user)` utility that returns trimmed `nickname` if present, else `email`.
- Update shell header to call the helper so whitespace-only nicknames fall back to email.
- Reuse helper in `WorkspaceStore.commentAuthorName` to align current-user name computation with the same rule.

Why this route
- Minimal surface area: 1 new helper file, 2 targeted call sites.
- Consistency: one source of truth for display-name logic used by current-user UI and comments author prefill.
- No API/backend changes; no i18n/a11y changes; admin/auth UIs remain email-centric.

Touched files
- frontend/src/app/shared/utils/display-name.ts: new helper.
- frontend/src/app/core/layout/shell/shell.ts: import helper and expose `displayName`.
- frontend/src/app/core/layout/shell/shell.html: use `displayName(currentUser)`.
- frontend/src/app/core/state/workspace-store.ts: use helper for current-user computed display.

Residual risks and open questions
- Bypass risk: Other components might directly use `user.nickname` in future. Mitigation: document/evangelize `getDisplayName`.
- Intentional email contexts: Admin tables, security, notifications — kept as-is. Confirm no additional places require nickname preference.
- Sorting/search ambiguity: If any list sorts by “name,” should sorting respect nickname first? Not addressed here.
- Edge case: If a user sets nickname equal to email, display is unchanged (still that value). Confirm if different behavior is desired.
- System users without emails: Helper falls back to empty string; `commentAuthorName` still falls back to ‘匿名ユーザー’. Confirm if a generic fallback is needed elsewhere.

Test checklist
- Shell header shows nickname when set, else email.
- Shell header falls back to email when nickname is whitespace-only.
- Comment composer default author name reflects nickname-first rule; with whitespace nickname, falls back to email; when logged out, shows ‘匿名ユーザー’.
- Admin “Users” and auth pages remain email-only as before.
- Visual alignment unchanged; no layout regressions.

```json
{"steps":["coder"],"notes":"Add a shared getDisplayName(user) utility and adopt it in the shell header and WorkspaceStore for consistent nickname-first display with trim fallback to email. Keep admin/auth displays unchanged.","tests":"1) Set nickname='Hanako', email='hanako@example.com' -> shell shows 'Hanako'. 2) Set nickname='   ', email='hanako@example.com' -> shell shows 'hanako@example.com'. 3) Remove nickname (null/undefined), keep email -> shell shows email. 4) Comment composer prefill matches the same rules; when logged out, shows '匿名ユーザー'. 5) Admin user list and auth forms still show emails only."}
```