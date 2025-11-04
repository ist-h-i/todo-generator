**Selector: Close On Option Click — Documentation Update**

- Outcome: No code change required. The custom selector already closes its option panel immediately when an option is clicked and restores focus appropriately.

**Evidence**

- Option click binding selects and closes:
  - `(click)="onOptionClick(opt)"` on options in `frontend/src/app/shared/ui/select/ui-select.ts`
  - `onOptionClick` updates the value and calls `closePanel(true)` to close and restore focus.
- Keyboard parity:
  - Enter selects the active option and closes (handled via the same selection path).
  - Escape closes the panel without changing selection.
- Outside click:
  - Document-level handler closes when clicking outside the component without forcing focus back to the trigger.
- Multi/size variants:
  - Use native `<select>` and are unaffected.

**Acceptance Criteria Mapping**

- Click selects and closes: Met (click → select → `closePanel(true)`).
- Focus management: Met (focus returns to the trigger on intentional close).
- Keyboard parity: Enter selects and closes; Escape closes; outside click closes.
- Multi-select/native path: Unchanged.

**Manual Verification Checklist**

1. Open selector → click an option → value updates, panel closes, focus returns to trigger.
2. Open selector → Arrow keys to option + Enter → selection and close.
3. Press Escape → panel closes as before.
4. Click outside → panel closes without stealing focus.
5. Check multi/size variants → native `<select>` behavior unchanged.

**Residual Risks & Open Questions**

- Space key handling: Enter selects/closes; do we also want Space to select/close for parity with some native controls?
- Future overlay/portal rendering: If the panel is moved outside the root (e.g., to a portal), revalidate the outside-click containment logic.
- Rich option content: If labels ever include HTML, ensure continued sanitization/escaping to avoid XSS.
- Confirm scope: If a different selector component is intended, please share its file path to validate behavior there.

**Decision**

- Close the issue as “already compliant.” Optional follow-up (separate, tiny): add Space key selection if desired for keyboard parity.