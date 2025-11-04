**Summary**

- Change the selector’s behavior so that when a user clicks an option, the selector’s option panel closes immediately.

**Assumptions**

- “Selector” refers to a custom dropdown/select component in this project (not the native HTML `select`).
- The current issue is that the options panel does not close on option click (e.g., only closes on blur or external click).
- Single-select behavior is desired (closing on selection). If multi-select exists, its behavior may differ.

**Constraints**

- Minimal code changes; avoid refactors or broad UI/UX changes.
- Deliver a self-contained fix without introducing regressions.
- Preserve existing accessibility and keyboard interactions where possible.

**Unknowns**

- Which component(s) is “selector” (file/path/component name)?
- Is multi-select supported, and should it close after each selection?
- Are there keyboard and screen reader requirements (e.g., Enter/Space selection should also close)?
- Are there debounce/search-input interactions inside the panel that could be affected?
- Current event handling specifics (e.g., click vs mousedown leading to blur ordering issues).
- Framework/library in use (React/Vue/Svelte/etc.) and any shared dropdown utility.

**Risks**

- Using `onClick` may conflict with blur events (panel might close before selection registers or vice versa); `onMouseDown` may be needed.
- Potential regressions in multi-select or typeahead/searchable dropdowns.
- Accessibility regressions (focus management, ARIA roles, ESC handling).
- If options render in a portal, event propagation/closing logic may need careful handling.

**Acceptance Criteria (Proposed)**

- Clicking an option selects it and closes the options panel.
- Focus returns to the selector trigger (or follows current accessibility pattern).
- Keyboard selection (Enter/Space) mirrors the click behavior.
- No change to multi-select behavior unless specified.

## Clarifying questions

- Which component(s) implements the selector options panel (file/component names)?
- Is the selector single-select only, or do we also support multi-select? If multi-select, should the panel close after each selection?
- Are there existing accessibility requirements we must preserve (focus return, ARIA attributes, ESC to close)?
- Should keyboard selection (Enter/Space) also close the panel?
- Any known interactions with search/typeahead inside the panel we must consider?