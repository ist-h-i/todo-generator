**背景**
- Request: Change selector behavior so the options panel closes immediately when an option is clicked.
- Scope: Custom single-select selector only; avoid broader UI/UX changes.
- Note: Prior analysis indicates this behavior already exists (click selects and closes). However, the referenced frontend file paths are not present in this repo snapshot; evidence is from prior stage artifacts.

**変更概要**
- No code change required if targeting the custom single‑select component described in prior stages:
  - Option click triggers selection and calls a close routine that restores focus to the trigger.
  - Enter key selection mirrors click; Escape and outside click close as expected.
- If the intended selector is a different component, please provide its file path; we can apply a minimal change (ensure option click handler runs selection, then closes panel, returning focus to trigger).

**影響**
- With no changes: current behavior already matches the requirement; no regression risk.
- If a fix is needed in another component:
  - Minimal, localized change to option click handler.
  - Should not affect multi‑select/native `<select>` paths.
  - Maintain existing accessibility (focus return, ARIA roles).

**検証**
- Manual checks (single‑select):
  - Open → click an option → value updates, panel closes, focus returns to trigger.
  - Arrow keys + Enter → selection and close.
  - Escape → closes; outside click → closes without stealing focus.
  - Multi/size/native `<select>` paths remain unchanged.
- Repo note: I searched for the referenced selector files but did not find them in this workspace. If the component lives elsewhere, please share the correct path to validate directly.

**レビュー観点**
- Confirm correct target component and file path for the selector.
- Confirm whether Space key should also select/close (Enter already does per prior analysis).
- Confirm single‑select scope only; multi‑select should not auto‑close on each selection.
- Ensure focus management remains intact (return focus to trigger on intentional close).
- If the panel is ever ported to a portal/overlay, re‑validate outside‑click containment.

Residual risks / open questions:
- File location mismatch: The earlier-referenced `frontend/src/app/shared/ui/select/ui-select.ts` is not present in this repository snapshot. Please confirm the actual component path.
- Keyboard parity: Do we also want Space to select/close for parity with some native controls?
- If options contain rich HTML in the future, ensure labels remain escaped/sanitized to avoid XSS.
- If selection triggers server-side changes, confirm CSRF protection and server-side allowlisting of values.