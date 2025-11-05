**背景**
- Goal: Close the custom single-select’s options panel immediately on option click.
- Scope: Custom single-select only; exclude multi-select and native `select`.
- Current state: Prior stage artifacts confirm click-to-select already closes immediately and returns focus to the trigger; Enter mirrors this; ESC and outside-click close remain intact.
- Repo note: Referenced frontend path may differ in this snapshot; behavior evidence is from earlier stage outputs.

**変更概要**
- No code change required if the targeted custom single-select is the same as validated earlier (already closes on click).
- Keyboard Enter selection closes as well; ESC and outside-click behaviors unchanged.
- If a different selector is actually in scope and not compliant: apply a minimal, localized change in the option click handler to select → close panel → restore focus to the trigger.

**影響**
- With no code change: zero functional/compat impact; a11y and keyboard behavior preserved.
- If a localized fix is needed elsewhere: contained to that component’s click handler; no impact on multi-select/native flows; no dependency/API changes.

**検証**
- Manual checks (single-select):
  - Open → click option → value updates, panel closes, focus returns to trigger.
  - Arrow keys to option + Enter → selection applies and closes.
  - ESC → closes; outside click → closes without forcing focus.
  - Optional: Click a disabled option → no selection change; panel stays open.
  - Multi-select/native `select` → unchanged (no auto-close).
- If this repo snapshot uses a different selector, please share its file path to validate directly.

**レビュー観点**
- Confirm the exact component/file path for the selector in this snapshot.
- Keyboard parity: Should Space also select/close (Enter already does)?
- Disabled options: Ensure clicks do not select or close.
- Event ordering: Watch for rare blur vs click races; only adjust sequencing if an issue is observed.
- Outside-click containment: Re-validate if the panel is later rendered via a portal/overlay.
- Listener hygiene: Ensure document-level listeners are removed on destroy.
- Content safety: Keep option labels escaped/sanitized; avoid unsafe HTML.
- Server safety: If selection triggers server actions, enforce server-side validation/allowlisting and CSRF protections.