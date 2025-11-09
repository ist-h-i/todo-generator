**Result**

- No code changes needed. The selector already closes its option panel when an option is clicked.

**Key References**

- Click binding on each option: frontend/src/app/shared/ui/select/ui-select.ts:98
- Click handler selects value and closes panel: frontend/src/app/shared/ui/select/ui-select.ts:348–356
- Close routine (restores focus when appropriate): frontend/src/app/shared/ui/select/ui-select.ts:330–346
- Keyboard Enter selects active option and closes: frontend/src/app/shared/ui/select/ui-select.ts:547–552
- Outside click closes without forcing focus: frontend/src/app/shared/ui/select/ui-select.ts:522–529

**What I Verified**

- In single-select mode, `(click)="onOptionClick(opt)"` triggers `onOptionClick`, which updates the value, syncs the hidden native `<select>`, and calls `closePanel(true)` to close and return focus to the trigger.
- ESC and outside click behaviors are unchanged and correct.
- Multi/size variants use the native `<select>` path and are unaffected.

**No Patch Required**

- The current implementation already meets “close the selector’s option panel when an option is clicked.”

**Manual Checks (suggested)**

- Open the selector, click an option → value updates and panel closes; focus returns to trigger.
- Use Arrow keys + Enter → selection and close.
- Press ESC → closes as before.
- Multi/size (native) variants behave unchanged.

**Residual Risks / Open Questions**

- Do we also want Space to select/close for keyboard parity? Currently Enter handles this.
- If you’ve observed any blur-vs-click ordering issues in specific browsers, we can switch the option handler to `mousedown` for earlier capture; otherwise, no change is recommended to keep impact minimal.

**Commands**

- None.