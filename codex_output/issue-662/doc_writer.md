**Doc Writer Findings**

- Scope: Update selector to close its options panel immediately on option click (single-select only).

**Conclusion**
- No code change required. The current selector already selects and closes on option click and restores focus to the trigger.

**Evidence**
- Option click binding: `frontend/src/app/shared/ui/select/ui-select.ts:98` `(click)="onOptionClick(opt)"`
- Close routine with optional focus restore: `frontend/src/app/shared/ui/select/ui-select.ts:330` `closePanel(restoreFocus)`
- Click handler selects then closes: `frontend/src/app/shared/ui/select/ui-select.ts:348–355`
- Outside click closes without forcing focus: `frontend/src/app/shared/ui/select/ui-select.ts:528`
- Keyboard Enter selects and closes: `frontend/src/app/shared/ui/select/ui-select.ts:551`
- Escape closes: `frontend/src/app/shared/ui/select/ui-select.ts:555`
- Multi/size variants use native `<select>` (unchanged path).

**Acceptance Check Mapping**
- Click option selects and closes: yes (click → onOptionClick → closePanel(true)).
- Focus restores to trigger after intentional close: yes (`closePanel(true)`).
- Keyboard Enter mirrors click: yes (calls `onOptionClick`).
- Outside click and ESC close unchanged: yes.
- Multi-select/native path unaffected: yes.

**Manual Test Notes**
- Open selector → click an option → value updates, panel closes, focus returns to trigger.
- Arrow keys + Enter → selection and close.
- ESC closes; outside click closes without stealing focus.
- Multi/size (native `<select>`) behaves unchanged.

**Residual Risks / Open Questions**
- Space key: Should Space also select/close for parity with native selects? Currently only Enter selects/closes.
- Future overlay/portal rendering could affect outside-click containment; recheck if refactored.
- If options ever include rich HTML, ensure labels remain escaped/sanitized to avoid XSS (currently using `{{ opt.label }}` is safe).