**Scope**

- Minimal change: reposition the existing hover/toast stack from top-right to bottom-right.
- Keep ordering as originally specified: newest on top.
- Preserve current entry/exit animations; only adjust positioning and any transform origins if needed.

**Proposed Changes**

- Update the host stack container styles to anchor at bottom-right instead of top-right.
  - Replace `top` with `bottom` (respect safe-area: `bottom: calc(1rem + env(safe-area-inset-bottom, 0px))`).
  - Ensure `right` remains set; position stays `fixed`.
  - Keep `flex-direction: column` so newest-first rendering still shows “newest above older”.
- Confirm item animations remain coherent:
  - Entry “drop from top” still reads fine within a bottom-right stack; no code changes unless there’s a hard-coded `transform-origin: top`.
  - Exit slide-out-right remains unchanged.
- No service or API changes needed; queue and timers unaffected.

**Files Likely Touched**

- `frontend/src/app/core/layout/hover-messages/hover-message-stack.component.scss`
- If inline styles are used, adjust in:
  - `frontend/src/app/core/layout/hover-messages/hover-message-stack.component.html`
  - Or component TS `styles` array if applicable.

**Validation**

- Visual: messages appear at bottom-right; newest still at the top of the stack; entry/exit animations behave; z-index remains above app content.
- Behavior: durations unchanged (error sticky; warning 10s; notice 5s; system ≥3s; loading persists until completed).
- Cross-check mobile safe area and notches via `env(safe-area-inset-bottom)`.

**Residual Risks / Open Questions**

- Bottom-right overlap with FAB/chat widgets or cookie banners; safe-area/bottom spacing may need small tuning.
- If a bottom-anchored “grow upward” stack is later desired (newest closest to screen edge), the flex layout and/or `ngFor` order will need an additional (but still small) adjustment.

```json
{"steps":["coder"],"notes":"Move hover/toast stack from top-right to bottom-right with minimal CSS changes. Keep newest-on-top ordering and existing animations. No service or API changes. Verify safe-area padding and z-index.","tests":"Manual: trigger warning/notice/system/loading toasts and confirm container is bottom-right, newest on top, entry drop-in and exit slide-right animations unchanged, timers behave per severity. Mobile: confirm safe-area inset prevents clipping; verify no overlap with bottom UI elements. Error: ensure it remains persistent at bottom-right until programmatically dismissed."}
```