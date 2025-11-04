**Plan Summary**
Move the Competency Level management UI (list + create/edit/delete) from the “API・日次上限” tab to directly under the “コンピテンシー” registration section within the existing Admin page. Preserve all services, validations, and i18n. Remove the duplicated UI from the original tab. Keep the change frontend-only and minimize code churn by reusing existing templates/blocks.

**Minimal Stage Route**
- requirements_analyst: Confirm scope, finalize placement and any redirect/notice behavior.
- coder: Relocate the template block, adjust bindings if needed, remove old section.
- implementation_reviewer: Verify no logic regressions, duplication removed, bindings intact.
- uiux_reviewer: Check layout, spacing, visual hierarchy, and basic keyboard flow.
- release_manager: Update changelog/PR notes, version bump if needed, merge.

**Execution Details**
- Identify and move the competency level UI block currently under “API・日次上限” in `frontend/src/app/features/admin/feature/admin-page.component.html` into the コンピテンシー section (immediately below the competency registration form).
- Remove the original block from the “API・日次上限” tab to avoid duplication.
- Ensure any `*ngIf`, `formGroup`, and `[(ngModel)]`/Reactive Form bindings remain valid in the new context.
- Keep i18n keys unchanged; ensure labels still render.
- Confirm no route changes are needed; if anchors are used, update anchor IDs and any internal links.
- Update or adjust any related unit/E2E tests or snapshots that referenced the old location.

**Handoffs and Checks**
- After coding, reviewer verifies no new logic added, only relocation.
- UI/UX reviewer validates the new placement visually and with basic keyboard navigation.
- Release manager documents the relocation and any potential impact to deep links.

**Residual Risks**
- Existing bookmarks or deep links to the old tab section may break.
- Minor layout/spacing differences in the new section container.
- Keyboard tab order and focus management may subtly change.
- Any analytics/test selectors targeting the old DOM location need updates.

**Open Questions**
- Remove the old section entirely or show a short notice with a link to コンピテンシー? (Default: remove entirely.)
- Any preference for exact placement order within コンピテンシー (e.g., after create form, before list)?
- Are there analytics or tests relying on the old location selectors/anchors?

**Acceptance Criteria**
- Competency Levels management (list + create/edit/delete) appears under コンピテンシー.
- The same functionality, validation, and data persistence work unchanged.
- The Levels UI is removed from “API・日次上限”.
- i18n strings render correctly; no console errors.

```json
{
  "steps": [
    "requirements_analyst",
    "coder",
    "implementation_reviewer",
    "uiux_reviewer",
    "release_manager"
  ],
  "notes": "Lean route focused on a simple frontend UI relocation. Reuse existing templates/services; no backend changes. Review targets logic parity and UI/keyboard basics. Main risk: broken deep links and subtle layout shifts.",
  "tests": "- Navigate to Admin > コンピテンシー; verify Levels UI appears directly under competency registration.\n- Create a new level; see it listed; refresh and confirm persistence.\n- Edit and delete a level; confirm validation and error handling match previous behavior.\n- Confirm the Levels UI is absent from API・日次上限.\n- Verify i18n labels render; no console errors.\n- Keyboard test: Tab through controls in コンピテンシー; focus order remains logical.\n- If E2E exists: update selectors to new section and run affected specs."
}
```