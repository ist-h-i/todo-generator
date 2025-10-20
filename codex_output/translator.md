**English Summary**
Implement a centralized hover/toast message manager that stacks notifications at the bottom-right of the screen (not top-right). Newest messages should appear above older ones within the stack. Messages auto-dismiss by severity; errors persist; loading persists until completion. Dismissal animates by sliding out to the right.

**Expected Behavior**
- Placement: bottom-right fixed container; vertical stack.
- Order: newest above older within the stack (confirm for bottom-right).
- Entry: animated appearance; prior spec said “drop from top,” which may conflict with bottom anchoring; slide-in from right is acceptable if preferred.
- Exit: slide-out to the right on dismissal.
- Durations/colors:
  - Error: persistent, red.
  - Warning: 10s, yellow.
  - Notice: 5s, green.
  - System/Loading: ≥3s; loading persists until completion, blue.
- Queue: in-memory array; ID-based control for update/dismiss.

**Assumptions**
- Angular SPA; implement as a service + a single host component.
- No new dependencies; CSS-only animations.
- Use existing design tokens for colors/shadows.
- Programmatic API supports show/update/dismiss, and loading returns an ID.

**Constraints**
- Minimal changes; avoid replacing broad UI unless necessary.
- Deliver a complete, self-contained outcome without new packages.

**Unknowns**
- Exact color/shadow tokens for severities.
- Max visible toasts and overflow behavior.
- Whether sticky errors need a close button.
- A11y requirements (roles, aria-live, keyboard dismissal).
- Hover-to-pause timers behavior.
- Deduplication of repeated messages.
- Interaction with existing notification mechanisms.

**Clarifying questions**
- With bottom-right placement, should new messages appear at the bottom (closest to the edge, pushing older upward) or remain “newest on top” as originally specified?
- Entry animation preference at bottom-right: keep “drop from top,” switch to “slide-in from right,” or a subtle fade/scale-in?
- Do sticky errors require a visible close button, or are they programmatic-only?
- Cap visible toasts (e.g., 4) and queue the rest?
- Any specific a11y requirements (aria-live level, roles, focus handling, keyboard dismissal)?
- Should timers pause on hover/focus?
- Dedup policy for identical repeated messages?
- Any mobile safe-area padding and z-index layering constraints?
- Should we replace or integrate with any existing notification system?

**Residual risks**
- Visual mismatch if “drop from top” is retained at bottom-right; may look odd without confirmation.
- Persistent errors can accumulate without a close affordance.
- Overlap risks with other bottom-anchored UI (chat widgets, FABs, nav bars) without safe-area rules.