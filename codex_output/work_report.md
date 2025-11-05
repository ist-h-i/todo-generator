**背景**
- Requirement: In the custom single-select, close the options panel immediately when an option is clicked.
- Scope: Custom single-select only; exclude multi-select and native `<select>`.
- Current state: Prior stage outputs confirm click-to-select closes immediately (focus returns to trigger); Enter mirrors this; ESC and outside-click close remain intact.
- Repo note: The previously referenced frontend file path does not exist in this snapshot; evidence comes from earlier stage artifacts.

**変更概要**
- No code change required if the target is the confirmed custom single-select (behavior already matches requirements).
- Keyboard Enter selection closes as well; ESC and outside-click behaviors unchanged.
- If a different selector component is actually in scope and is not compliant, apply a minimal, localized change to the option click handler: apply selection → close panel → restore focus to trigger.

**影響**
- With no code change, there is no functional or compatibility impact; behavior already aligns with the requirement.
- If a localized fix is needed in another component, the change is contained to its click handler and does not affect multi-select/native paths or other UI.
- Accessibility (focus management, roles/states) remains as-is; no dependency or API changes.

**検証**
- Manual checks (single-select):
  - Open → click an option → value updates, panel closes, focus returns to the trigger.
  - Arrow keys to option + Enter → selection applies and closes.
  - ESC → closes; outside click → closes without forcing focus back.
  - Multi-select/native `<select>` → unchanged (no auto-close).
  - Optional: Click a disabled option → no selection change; panel stays open.
- Note: If this repo snapshot uses a different selector, please share its path to validate directly.

**レビュー観点**
- Confirm the exact component/file path for the selector in this repository snapshot.
- Keyboard parity: Should Space also select/close in single-select (currently Enter is supported)?
- Disabled option handling: Ensure clicks on disabled options do not select or close.
- Event ordering: Watch for rare blur vs click races; only adjust sequencing if an issue is observed.
- Outside-click containment: Re-validate if the panel is later rendered via a portal/overlay.
- Listener hygiene: Ensure document-level listeners are removed on destroy.
- Content safety: If option labels ever include rich HTML, keep sanitization/escaping to avoid XSS.
- Server-side safety: If selection triggers server actions, enforce server validation/allowlisting and CSRF protections.
- Global clickjacking defenses (e.g., frame-ancestors/X-Frame-Options) should remain enabled.