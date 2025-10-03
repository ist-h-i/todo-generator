**Overview**
- Goal: On Board subtask cards, stack Status above Content by changing the container currently using `flex items-start justify-between gap-2` to a vertical layout.
- Approach: Tailwind-only class update plus DOM order alignment; no behavioral changes.

**Target Scope**
- Board view subtask card only (template that renders subtask status and content).
- All breakpoints; no responsive exceptions.
- Minimal change confined to the specific container wrapping Status and Content.

**Layout Change**
- Replace `flex items-start justify-between gap-2` with `flex flex-col items-start justify-start gap-2`.
- Ensure Status element precedes Content in the DOM to match the visual order.
- Preserve existing spacing (`gap-2`) and alignment (start).

**DOM Order & Accessibility**
- Visual and reading/tab order align: Status first, then Content.
- No introduction of CSS-only reordering; avoid `order-*` utilities.
- Keep existing roles/labels; do not add `[innerHTML]` bindings.

**Interfaces**
- Inputs: Subtask model (e.g., `status`, `title`, `description`).
- Outputs: Existing status change events (e.g., `(statusChange)` or equivalent) remain unchanged.
- No new inputs/outputs, no selector/id changes.

**Data**
- No new data fields or transformations.
- Continue safe rendering via interpolation for Content.

**Failure Handling**
- Functional behavior untouched; existing status update error handling applies (e.g., toast/rollback).
- If any tests rely on sibling order or `justify-between`, update them to rely on stable selectors (e.g., `data-testid`) instead of layout order.

**Trade-offs**
- Tailwind utilities vs. custom CSS: utilities preferred for minimal, localized change and consistency with codebase.
- DOM reorder vs. CSS order: DOM reorder chosen for accessibility correctness and simpler focus/AT behavior.
- Keeping `gap-2` maintains visual consistency; removing `justify-between` prevents unintended vertical stretching.

**Risks & Mitigations**
- Risk: Container class reused elsewhere. Mitigation: Apply change only in the subtask card template within Board.
- Risk: Other children inside container affected by vertical layout. Mitigation: Verify only Status and Content are immediate children; if others exist, wrap non-target items or split containers minimally.
- Risk: Very long content affecting layout. Mitigation: Preserve existing truncation/line-clamp if present; do not expand.

**Validation**
- UI shows Status stacked above Content with compact vertical spacing.
- Container classes reflect `flex flex-col items-start justify-start gap-2`; `justify-between` removed.
- Screen reader and tab order read Status before Content.
- No overflow/clipping across mobile/tablet/desktop.
- No regressions in other cards/views.

**Estimated Touchpoint**
- Subtask card template in Board feature (e.g., a template under `frontend/src/app/features/board/...`).

**Rollback**
- Revert class change to `flex items-start justify-between gap-2` and restore prior DOM order if needed.