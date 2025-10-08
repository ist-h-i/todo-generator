**Outcome**
- The per-item limit for Profile “業務内容/ロール” is raised to 200 characters across backend validation and Angular UI. No DB migration is required (roles stored as JSON).

**Coverage**
- Backend validation: limit constant set to 200 and enforced with updated JA message.
  - backend/app/services/profile.py:15 `_MAX_ROLE_LENGTH = 200`
  - backend/app/services/profile.py:155–159 rejects >200 and returns: 業務内容は1項目あたり200文字以内で入力してください。
- Data model: roles stored as JSON; no column length constraint.
  - backend/app/models.py:21,43,52 roles defined as `JSON`
  - backend/app/models.py:33 shows `roles JSON DEFAULT '[]'` in docs
- Frontend UI: custom role input and helper/error text reflect 200.
  - frontend/src/app/core/profile/profile-dialog.ts:307 `const MAX_CUSTOM_ROLE_LENGTH = 200;`
  - frontend/src/app/core/profile/profile-dialog.ts:330 `maxCustomRoleLength` bound to template
  - frontend/src/app/core/profile/profile-dialog.html:334 `[attr.maxlength]="maxCustomRoleLength"`
  - frontend/src/app/core/profile/profile-dialog.html:350 “最大{{ maxCustomRoleLength }}文字 …”
- No remaining 32-char constraints related to roles found.

**Validation**
- Server: payload with a 200-char role passes; >200 is rejected with the 422 error text above.
- UI: custom role field accepts up to 200 chars; shows client error at 201.
- Persistence: roles are arrays of strings in JSON; 200-char items persist.

**Deploy Notes**
- Safe order: API + SPA deploy (no DB migration needed).
- Optional smoke checks:
  - Create/edit profile with 200-char custom role; ensure read-back matches.
  - Verify 201-char role is blocked in UI and by API.

**Residual Risks / Open Questions**
- Counting uses default string length (Python/TS), not grapheme clusters; aligns with current behavior.
- Wording differs slightly: UI “担当領域…文字以内…”, backend “業務内容…文字以内…”. Acceptable, but can be unified if desired.
- If external consumers assumed ≤32 chars, review them separately (none found in this repo).