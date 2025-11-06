**Release Readiness**

- Verdict: Ready to ship. Behavior already matches “close on option click” with focus return.
- Scope: Custom single-select only; multi-select and native `<select>` unchanged.

**What Changed**

- No code changes. Existing implementation already closes the panel on option click and restores trigger focus.

**Evidence**

- Option click bound to selection + close: frontend/src/app/shared/ui/select/ui-select.ts:98
- Handler selects, syncs, and closes with focus restore: frontend/src/app/shared/ui/select/ui-select.ts:348
- Close routine supports optional focus restore: frontend/src/app/shared/ui/select/ui-select.ts:330
- Outside click closes without forcing focus: frontend/src/app/shared/ui/select/ui-select.ts:523
- Enter selects active option (mirrors click): frontend/src/app/shared/ui/select/ui-select.ts:551
- Escape closes panel and restores focus: frontend/src/app/shared/ui/select/ui-select.ts:555

**Verification Steps**

- Open selector → click an option → value updates, panel closes, focus returns to trigger.
- Arrow keys to an option + Enter → selection applies and closes.
- Press ESC → panel closes; selection unchanged; focus returns to trigger.
- Click outside → panel closes; focus not forcibly moved.
- Click disabled option → no selection change; panel remains open.
- Multi-select/native `<select>` paths behave unchanged.

**Compatibility/Impact**

- Zero code churn; no API or dependency changes.
- A11y and keyboard behavior preserved.
- No impact to multi-select/native flows.

**Residual Risks / Open Questions**

- Space key parity: Should Space also select/close in single-select (Enter already does)?
- Disabled option semantics: Confirm click does not select or close (current guard present).
- Future overlay/portal refactor: Re-validate outside-click containment if panel renders outside the root.
- Content safety: If option labels ever include rich HTML, keep sanitization/escaping to prevent XSS.
- Server safety: If selection triggers server actions, ensure server-side validation/allowlisting and CSRF remain enforced.

**Rollback Plan**

- Not applicable (no changes). If a discrepancy is observed, apply a localized tweak in the option click path to maintain select → close → focus restore.