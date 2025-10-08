I’ll make tightly scoped changes to raise the per-item limit from 32 → 200 for profile “業務内容/ロール” across backend validation and Angular UI input. No DB migration is needed because roles are stored as a JSON array without per-item length constraints.

Changes made

- Backend
  - backend/app/services/profile.py:15
    - Replace `_MAX_ROLE_LENGTH = 32` with `_MAX_ROLE_LENGTH = 200`
    - Effect:
      - Server-side validator `parse_roles` now allows up to 200 chars per item.
      - Error text updates automatically to: 業務内容は1項目あたり200文字以内で入力してください。

- Frontend (Angular)
  - frontend/src/app/core/profile/profile-dialog.ts:307
    - Replace `const MAX_CUSTOM_ROLE_LENGTH = 32;` with `const MAX_CUSTOM_ROLE_LENGTH = 200;`
    - Effect:
      - Custom role input `[attr.maxlength]` updates to 200.
      - UI error text updates automatically to: 担当領域は200文字以内で入力してください。
      - Helper text “最大{{ maxCustomRoleLength }}文字” now reflects 200.

Why no DB migration

- The `roles` field is defined as `JSON` in `backend/app/models.py` and does not impose a per-item string limit at the database layer. Widening is therefore unnecessary and there’s no index dependent on string length for these items.

Commands to validate (optional)

- Backend tests:
  - From repository root: `pytest -q`
- Frontend type-check/build (if environment supports Node):
  - `npm ci`
  - `npm run build`

Residual risks / notes

- Counting remains based on Python/TS string length (code units), not grapheme clusters; this preserves existing semantics.
- Predefined option labels are already well below 200 chars; no UI layout issues expected.
- If there are external consumers assuming ≤ 32 chars, they should be reviewed separately (none found in this repo).

Diff summary

- backend/app/services/profile.py:15
  - - `_MAX_ROLE_LENGTH = 32`
  - + `_MAX_ROLE_LENGTH = 200`
- frontend/src/app/core/profile/profile-dialog.ts:307
  - - `const MAX_CUSTOM_ROLE_LENGTH = 32;`
  - + `const MAX_CUSTOM_ROLE_LENGTH = 200;`