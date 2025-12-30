**Integrator Findings**

- Outcome: No code change required — the selector already closes its options panel when an option is clicked.

**Evidence**
- Option click binding on items: frontend/src/app/shared/ui/select/ui-select.ts:98
- Click handler selects then closes: frontend/src/app/shared/ui/select/ui-select.ts:346
- Close routine (with optional focus restore): frontend/src/app/shared/ui/select/ui-select.ts:330
- Keyboard Enter selects and closes: frontend/src/app/shared/ui/select/ui-select.ts:547
- Outside click closes without forcing focus: frontend/src/app/shared/ui/select/ui-select.ts:522

**Acceptance Mapping**
- Click option selects and closes the panel (focus returns to trigger).
- Enter key mirrors click; Escape closes; outside click closes.
- Multi/size variants use native `<select>` and are unaffected.

**Residual Risks / Open Questions**
- Space key does not select/close; do we want Space parity with Enter?
- If the panel is ever moved to a portal/overlay, revalidate outside‑click containment logic.
- Confirm that this issue targets the custom single‑select only (not native multi/size paths).

**Manual Checks**
- Open → click an option → value updates, panel closes, focus returns to trigger.
- Arrow keys + Enter → selection and close.
- ESC → closes; outside click → closes without focus jump.