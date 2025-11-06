**Release Readiness**

- Verdict: Ready to ship. Current custom single-select already closes on option click and restores focus to the trigger.
- Scope: Custom single‑select only; multi‑select and native `<select>` unchanged.

**What Changed**

- No code changes. Behavior matches the requirement as‑is.

**Evidence**

- Option click binding on items: frontend/src/app/shared/ui/select/ui-select.ts:98
- Click handler selects then closes with focus restore: frontend/src/app/shared/ui/select/ui-select.ts:348
- Close routine supports optional focus restore: frontend/src/app/shared/ui/select/ui-select.ts:330
- Outside click closes without forcing focus: frontend/src/app/shared/ui/select/ui-select.ts:522
- Enter selects active option and closes: frontend/src/app/shared/ui/select/ui-select.ts:547
- Escape closes panel: frontend/src/app/shared/ui/select/ui-select.ts:554

**Verification Steps**

- Open → click an option → value updates, panel closes, focus returns to trigger.
- Arrow keys to an option + Enter → selection applies and closes.
- Press ESC → panel closes; selection unchanged.
- Click outside → panel closes; focus is not forcibly moved.
- Click a disabled option → no selection; panel remains open.
- Confirm multi‑select/native `<select>` behavior unchanged.

**Compatibility & Impact**

- Zero code churn; no API or dependency changes.
- A11y and keyboard behavior preserved.
- No impact to multi‑select/native flows.

**Residual Risks / Open Questions**

- Space key parity: Should Space also select/close in single‑select (Enter already does)?
- If the panel rendering is later moved to a portal/overlay, re‑validate outside‑click containment.
- Ensure option labels remain escaped/sanitized if rich content is ever introduced.
- If selection triggers server actions, confirm server‑side validation/allowlisting and CSRF protections remain enforced.
- If the target selector differs in another path/component, share that file path to validate behavior there.

**Rollback Plan**

- Not applicable (no changes). If a mismatch is observed, apply a localized tweak in the option click path to ensure select → `closePanel(true)` → focus restore, and add/adjust a small test if needed.

**Release Decision**

- Ship as‑is. Optional tiny follow‑up (separate): add Space key to mirror Enter for keyboard parity.