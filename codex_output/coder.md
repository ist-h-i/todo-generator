**Summary**
- Repositioned the global hover/toast stack from top-right to bottom-right with a minimal, CSS-only change.
- Ordering, durations, and animations remain unchanged (newest on top; drop-in/slide-out).

**Files Updated**
- frontend/src/app/core/layout/hover-messages/hover-message-stack.component.scss:1
  - Switched logical inset from top to bottom to anchor the stack at the bottom-right:
    - `inset-block-start` → `inset-block-end` in both base and desktop media query.

**Focused Diff**
- frontend/src/app/core/layout/hover-messages/hover-message-stack.component.scss:4
  - inset-block-start: clamp(16px, 12vh, 144px) → inset-block-end: clamp(16px, 12vh, 144px)
- frontend/src/app/core/layout/hover-messages/hover-message-stack.component.scss:21
  - inset-block-start: clamp(24px, 8vh, 160px) → inset-block-end: clamp(24px, 8vh, 160px)

**Behavior After Change**
- Stack is fixed at bottom-right.
- Newest messages still render above older ones within the stack.
- Entry remains “drop in” (translateY from -14px to 0); exit remains slide-out to the right.

**How to Verify**
- Run the app and trigger messages (warning/notice/system/loading).
- Confirm the container appears bottom-right; timers and severities behave as before.
- Ensure newest message appears above older ones in the bottom-right stack.

**Notes**
- If needed later, we can add safe-area padding for devices with notches: e.g., `bottom: calc(16px + env(safe-area-inset-bottom))`. Currently kept minimal per constraints.

**Residual Risks / Open Questions**
- Possible overlap with bottom-anchored UI (e.g., chat widgets, FABs, cookie bars). May require small spacing/safe-area adjustments if observed.