**背景**
- Request: Move Competency Level registration from “API・日次上限” to below the “コンピテンシー” registration section.
- Goal: Reduce context switching; manage levels alongside competencies.
- Scope: Frontend-only relocation; no service/API/schema changes.

**変更概要**
- Moved the Competency Levels UI (list + create) under the コンピテンシー tab/section.
- Removed the same section from the “API・日次上限” tab to avoid duplication.
- Kept all bindings, forms, i18n keys, and methods unchanged; no TS or backend edits.
- No routing/breadcrumb changes; purely a template relocation within the Admin page.
- Modified file: `frontend/src/app/features/admin/feature/admin-page.component.html`

**影響**
- Functionality preserved: same CRUD, validations, and permissions for levels.
- Information architecture improved: “API・日次上限” now focuses on API key and default limits.
- Residual risks and open questions (explicit):
  - Deep links/bookmarks to the old tab section may break.
  - Minor layout/focus-order shifts due to new container context.
  - E2E/analytics selectors targeting the old DOM location may need updates.
  - If edit/delete controls previously existed in that section, confirm parity in the new location.

**検証**
- Admin → コンピテンシー:
  - Levels list and “レベルを追加” form appear directly under the competency registration form.
  - Create/Edit/Delete a level; confirm list updates and persists after refresh.
  - Competency creation form’s level options reflect new levels as before.
- Admin → API・日次上限:
  - Levels section is absent; API key and default daily limit remain functional.
- General:
  - i18n strings render correctly; no console errors.
  - Basic keyboard navigation: tab order remains logical in the コンピテンシー section.

**レビュー観点**
- No logic regressions: bindings like `competencyLevels()`, `competencyLevelForm`, `createCompetencyLevel()`, and option providers still resolve.
- No duplication: verify the levels section is fully removed from “API・日次上限”.
- Layout/accessibility: headings hierarchy, spacing, and focus order under コンピテンシー remain clear.
- Tests/analytics: update selectors if they referenced the old location.
- Open questions for sign-off:
  - Should we leave a small notice/link in “API・日次上限” pointing to コンピテンシー, or is full removal preferred?
  - Exact placement under コンピテンシー acceptable (immediately after the registration form), or adjust order?