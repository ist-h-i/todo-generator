**Outcome**
- Added a reusable Angular Select UI component (CVA) and applied it to key forms (Reports, Admin) while keeping global, modern styling for all native selects.
- No React/shadcn introduced to avoid churn; existing Tailwind + SCSS already deliver the desired modern look.

**What I Changed**
- New component: `frontend/src/app/shared/ui/select/ui-select.ts:1`
  - Standalone Angular component implementing ControlValueAccessor.
  - Wraps native `<select>` with classes `form-control app-select` so it inherits app-wide modern styles.
  - Supports `formControlName`, `disabled`, `multiple`, and `size`; projects `option` content.
- Reports page: use `app-ui-select`
  - `frontend/src/app/features/reports/reports-page.component.ts:1` add `UiSelectComponent` to `imports`.
  - `frontend/src/app/features/reports/reports-page.component.html:1` replace two selects:
    - Proposal “推奨ステータス” → `<app-ui-select formControlName="status">...</app-ui-select>`
    - Proposal “優先度” → `<app-ui-select formControlName="priority">...</app-ui-select>`
- Admin page: use `app-ui-select`
  - `frontend/src/app/features/admin/page.ts:1` add `UiSelectComponent` to `imports`.
  - `frontend/src/app/features/admin/page.html:1` replace four selects:
    - Competency “レベル” → `<app-ui-select formControlName="level">...</app-ui-select>`
    - Evaluation “対象ユーザ” → `<app-ui-select formControlName="userId">...</app-ui-select>`
    - Evaluation “コンピテンシー” → `<app-ui-select formControlName="competencyId">...</app-ui-select>`
    - API 設定 “利用モデル” → `<app-ui-select formControlName="model">...</app-ui-select>`

**Why Not React/shadcn**
- The frontend is Angular (standalone components) with Tailwind and centralized SCSS for form controls. Creating `/components/ui` and integrating React/Radix would not compile here and would introduce unnecessary complexity. The modern, centered chevron design is already achieved globally via `frontend/src/styles/pages/_base.scss:1`.

**Default Paths**
- Components: `frontend/src/app/shared/ui` (added `select/ui-select.ts`).
- Styles: `frontend/src/styles/pages/_base.scss:1` (select styles already modern with a simple down arrow).

**Verification**
- Build and smoke test screens:
  - Reports and Admin: values bind correctly with reactive forms; focus/hover/disabled states intact; chevron is centered.
  - Other pages (Settings, Board, Analyze) still render modern selects via global SCSS.
- Keyboard navigation and focus ring remain visible.

**Notes**
- No new NPM packages needed.
- Remaining selects that use manual handlers (e.g., Settings/Board) can be migrated to `<app-ui-select>` later, but visual parity is already ensured by the centralized SCSS. If desired, I can extend the component to support `[(ngModel)]` and update those pages next.