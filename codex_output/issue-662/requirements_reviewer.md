**Summary**
- Goal: In custom single-select, clicking an option should immediately close the options panel and return focus to the trigger.
- Preserve existing keyboard and dismissal behaviors; exclude multi-select and native `<select>`.

**Scope**
- In: Custom single-select option-click behavior and focus on intentional close.
- Out: Multi-select auto-close, native `<select>`, overlay/portal refactors, backend/API changes, broader UI redesigns.

**Acceptance Criteria**
- Click option → value updates and panel closes immediately.
- Intentional close (click/Enter/Escape) → focus returns to the trigger.
- Arrow-key navigation unchanged; Enter selects and closes; Escape closes without selection change.
- Outside click closes without forcing focus to the trigger.
- Disabled options neither select nor close the panel.
- Multi-select and native `<select>` behavior unchanged.

**Non-Functional**
- Minimal, localized UI change (or confirmation if already compliant).
- No API/dependency changes; maintain current a11y roles/states and performance.
- No impact outside the custom single-select.

**Ambiguities / Gaps**
- Component/file path for the target selector in this snapshot not explicitly confirmed.
- Rendering model of the panel (inline vs overlay/portal) unspecified.
- Space key parity with Enter not defined.
- Presence and expected behavior of disabled options on click requires confirmation.
- Any tests/analytics tied to current close timing not identified.

**Validation Plan**
- Manual checks: click option closes and focuses trigger; Arrow+Enter selects/closes; Escape closes; outside click closes without focus jump; disabled option click does nothing; multi-select/native unchanged.

**Residual Risks / Open Questions**
- Blur vs click event sequencing races in some browsers; may require handler/event-order tuning if observed.
- If panel moves to a portal/overlay later, outside-click containment may need adjustment.
- Content safety: ensure option labels remain escaped/sanitized; avoid HTML injection.
- If selection triggers server actions, enforce server-side validation/allowlisting and CSRF protections.
- Do we need Space to also select/close for better keyboard parity?
- Confirm exact component path in this repo snapshot to anchor verification.