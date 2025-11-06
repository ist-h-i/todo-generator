**Summary**

- No code changes required. The selector already closes its option panel on option click and restores focus appropriately.

**What I Verified**

- Option click triggers close:
  - `(click)="onOptionClick(opt)"` on options: frontend/src/app/shared/ui/select/ui-select.ts:98
  - `onOptionClick` updates value, calls `onChange`, syncs native select, then `closePanel(true)`: frontend/src/app/shared/ui/select/ui-select.ts:348
  - `closePanel(true)` closes and restores focus to the trigger via microtask: frontend/src/app/shared/ui/select/ui-select.ts:303
- Keyboard parity:
  - Arrow navigation manages `activeIndex` and opens panel when needed: frontend/src/app/shared/ui/select/ui-select.ts:506
  - Enter selects active option and closes via `onOptionClick`: frontend/src/app/shared/ui/select/ui-select.ts:547
  - Escape closes panel with focus restore: frontend/src/app/shared/ui/select/ui-select.ts:554
- Outside click:
  - Document click closes when clicking outside the component root without forcing focus: frontend/src/app/shared/ui/select/ui-select.ts:522
- Blur handling:
  - Trigger `(blur)` only marks touched and does not close, preventing blur/click race issues: frontend/src/app/shared/ui/select/ui-select.ts:29

**Correctness & Readability**

- Event ordering is safe: trigger blur does not close; option `(click)` performs selection then closes; document click ignores inside clicks.
- Accessibility basics present: `role="listbox"` for panel and `role="option"` with `aria-selected` on items.

**Residual Risks / Open Questions**

- Space key selection: Currently Enter selects/closes; Space does not. Do you want Space to mirror Enter for keyboard parity?
- ARIA active option: No `aria-activedescendant` on the listbox nor IDs on options; not required by this issue, but could improve SR experience later.
- Future overlay/portal refactor: Recheck outside-click containment if the panel moves out of the root.

**Recommendation**

- Accept as-is for this issue. If desired, as a tiny follow-up, add Space key support for selection to match native select behavior.