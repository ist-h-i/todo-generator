**Functional Requirements**
- Move Competency Level management (list + create/edit/delete) from “API・日次上限” to directly under the “コンピテンシー” registration section.
- Remove the Levels UI from “API・日次上限” to avoid duplication.
- Preserve existing behavior: data flows, validations, permissions, and error handling.
- Reuse existing i18n labels/keys; no copy changes unless specified.
- Keep services/APIs unchanged; frontend layout relocation only.

**Non-Functional Requirements**
- Minimal code changes; reuse existing components/templates/logic.
- Frontend-only change; no DB or backend modifications.
- Maintain accessibility, responsive layout, and performance characteristics.
- Preserve current authorization/visibility rules.
- Keep navigation/breadcrumbs unchanged unless explicitly requested.

**Out Of Scope**
- New backend endpoints or API contract changes.
- Changes to competency level business rules or validation logic.
- Broad navigation/route redesign or unrelated admin refactors.
- Copywriting updates beyond relocation.
- Analytics overhaul beyond updating selectors if necessary.

**Assumptions**
- Competency and Level UIs live in `admin-page.component.html` and can be moved without refactors.
- No new routes required; a section move within the Admin page is sufficient.
- Existing tests (if any) can be minimally updated for selector/location changes.
- No schema or permission changes are needed.

**Risks**
- Broken bookmarks/deep links to the old “API・日次上限” section.
- Styling/layout regressions due to new parent container.
- Accessibility focus order or tab sequence changes after relocation.
- Tests/analytics selectors tied to the old DOM location need updates.
- Potential template context differences (e.g., `*ngIf`/form scope) after the move.

**Clarifying Questions**
- Should both the list and full create/edit/delete forms move under コンピテンシー?
- Remove the old section entirely, or leave a short notice/link in “API・日次上限”?
- Should route/breadcrumbs change to reflect the new location, or remain as-is?
- Any desired copy/label tweaks after relocation (Japanese text changes)?
- Are there tests or analytics tied to the old location that we should update?