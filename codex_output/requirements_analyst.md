**Functional Requirements**
- Stack subtask card “status” above “content” in the board view.
- Apply vertical layout within the specific subtask card container currently using `flex items-start justify-between gap-2`.
- Maintain left alignment and keep comparable spacing between status and content.
- No changes to data, copy, or behavior; layout-only update.
- Apply at all breakpoints (no responsive exceptions unless later specified).

**Non-Functional Requirements**
- Change is isolated to the subtask card on the board screen only.
- Minimal CSS/Tailwind changes (prefer utility class updates over new styles).
- Preserve accessibility and keyboard navigation order.
- No measurable performance impact.

**Acceptance Criteria**
- In the board view, each subtask card displays:
  - Status badge/label on top.
  - Content/text below the status.
- Visual spacing between status and content is present and consistent (e.g., equivalent to `gap-2`).
- Left alignment is preserved; widths remain consistent with existing card/container constraints.
- No horizontal layout remains for status/content at any viewport size.
- No unintended layout changes occur elsewhere in the app.
- Existing tests pass; no new failing lint/format checks.

**Out of Scope**
- Modifying text, statuses, API/data models, or business logic.
- Changing other card elements or global layout styles.
- Adding new responsive rules beyond vertical stacking.

**Risks & Assumptions**
- Assumes Tailwind is used and layout is controlled via utility classes.
- The same class string may be reused elsewhere; ensure selector or component scope targets only subtask cards.
- If DOM order is status after content, may need `order-*` utilities instead of markup changes.
- Long content may affect vertical spacing; ensure wrapping behaves as today.

**Open Questions**
- Exact component/template path(s) for the subtask card in the board view?
- Should spacing remain `gap-2` or be adjusted (e.g., `gap-1`/`gap-3`)?
- Any max-width or truncation rules desired for content in vertical mode?
- Are there responsive exceptions desired (e.g., horizontal on xl screens)?
- Do we need visual regression screenshots or updated UI tests?