**Release Readiness**

- Status: Ready to release. Frontend-only relocation of the Competency Level management UI; no backend or API changes.
- Scope minimized: Single template moved; no business logic changes; existing forms/services reused.

**What Changed**

- Added コンピテンシーレベル section under コンピテンシー:
  - frontend/src/app/features/admin/feature/admin-page.component.html:205
- Removed コンピテンシーレベル from API・日次上限; that tab now contains only API key and default limits:
  - frontend/src/app/features/admin/feature/admin-page.component.html:551

**Verification Steps**

- Navigate Admin → コンピテンシー:
  - Confirm コンピテンシーレベル list and “レベルを追加” form appear below “コンピテンシーを登録”.
  - Add a level; it appears in the list and persists after refresh.
- Navigate Admin → API・日次上限:
  - Confirm levels section is absent; API key and default limits work.
- Sanity check: コンピテンシー作成フォームの「レベル」選択肢が新しいレベルで更新される。
- Console: No errors. i18n strings render as before.

**Compatibility/Impact**

- Deep links or docs pointing to the old section under API・日次上限 will no longer land on levels.
- E2E/analytics selectors targeting the old DOM location may need updates (if present).

**Approvals Needed**

- Product/UX sign-off for the UI relocation within Admin.
- QA confirmation on the above verification steps across desktop and a small viewport.

**Rollback Plan**

- Revert the template move in `frontend/src/app/features/admin/feature/admin-page.component.html` to restore the levels section under API・日次上限.

**Open Questions**

- Do you want a notice or link in API・日次上限 pointing users to the new コンピテンシーレベル section, or is full removal acceptable? (Current: fully removed.)

**Residual Risks**

- Minor layout/focus order shifts due to new container context.
- Bookmarked anchors to the old tab (if any) won’t land on the new section.