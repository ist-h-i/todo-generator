## Functional Requirements
- Close the selector’s option panel immediately when an option is clicked.
- Ensure the click registers the selection before the panel closes.
- Maintain current focus behavior (ideally return focus to the trigger) unless project specifies otherwise.
- Keyboard selection (Enter/Space) should mirror click behavior for single-select.

## Non-Functional Requirements
- Minimal, targeted change with low impact; avoid refactors.
- Preserve existing accessibility (ARIA roles/states, ESC to close, focus management).
- Do not regress existing keyboard navigation or outside-click/blur closing.
- Maintain current behavior for multi-select unless specified otherwise.

## Out of Scope
- Redesigning the selector UI/UX.
- Adding new features (search/typeahead, portals).
- Changing multi-select behavior unless explicitly requested.

## Assumptions
- “Selector” refers to a custom dropdown/select component in this repository.
- Current behavior closes on blur/outside click, not on option click.
- Single-select is the primary target for close-on-select behavior.

## Risks
- Event ordering (blur vs click) may prevent selection; may require `mousedown` or controlled sequence (select → close).
- Potential regressions if a multi-select variant exists and should not close on each selection.
- Typeahead/search inputs inside the panel could lose focus unexpectedly.
- If options render via a portal, event propagation and close timing may need adjustment.
- Accessibility regressions if focus isn’t restored or ARIA states aren’t updated.

## Clarifying questions
- Which component(s)/file(s) implement the selector and options panel?
- Is there a multi-select variant, and should it close after each selection?
- What accessibility requirements must be preserved (focus return target, ARIA attributes, ESC handling)?
- Should keyboard selection (Enter/Space) also close the panel in single-select?
- Is there a search/typeahead inside the panel that could be affected by close-on-click?

## Acceptance Criteria
- Clicking an option selects it and closes the panel.
- Focus returns to the trigger (or matches current accessibility pattern).
- Enter/Space selection in single-select closes the panel as click does.
- No regression to ESC/outside-click closing or any multi-select behavior.