**English Restatement**
Move the Competency Level registration UI from the “API・日次上限” tab to be directly under the “コンピテンシー” (Competency) registration section so admins manage levels alongside competencies. The feature set remains unchanged; only the display location and navigation placement move.

**Assumptions**
- Frontend change only; no backend or DB schema updates.
- Existing services, APIs, and validation for levels remain unchanged.
- Authorization/visibility rules for managing levels stay the same.
- i18n labels/keys already exist and can be reused in the new location.
- The UI moved should include list + create/edit + delete actions for levels.

**Constraints**
- Minimal code changes; avoid new components unless reuse is impossible.
- Deliver a finished, self-contained change without altering business logic.
- Remove the levels UI from “API・日次上限” to avoid duplication.
- Preserve current behavior, form validations, and data flows.

**Unknowns**
- Exact component names/paths for Competency and Level management.
- Whether a dedicated route/URL is required under コンピテンシー or purely a tab/section move.
- Desired placement order within the コンピテンシー page/section.
- Existing deep links/bookmarks that point to the old tab.

**Clarifying Questions**
- Should we move both the list and the registration form (create/edit/delete) under コンピテンシー?  
- Do you want the old “API・日次上限” tab to show a redirect/link notice, or remove the section entirely?  
- Should the URL route/breadcrumb for level management change to live under コンピテンシー?  
- Any copy or label updates desired after relocation (Japanese text changes)?  
- Are there tests or analytics events tied to the old location that we should update?

**Acceptance Criteria**
- Competency Levels management (list + create/edit/delete) appears under コンピテンシー.
- The same functionality, validations, and data persist correctly.
- Levels UI is removed from “API・日次上限” (no duplication).
- Navigation/breadcrumbs (if any) reflect the new location; i18n intact.

**Residual Risks**
- Broken bookmarks/deep links to the old tab.
- Styling/layout regressions due to new container context.
- Accessibility or focus order changes after relocation.
- Missed updates to tests or analytics referencing the old location.