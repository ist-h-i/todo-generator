**English Summary**
Implement a lightweight notification (“hover message/toast”) manager that shows messages on the right side of the screen with animations. Newest messages appear at the top; older ones stack below. Messages auto-dismiss based on severity; errors persist; loading persists until completion. Messages slide out to the right when dismissed.

**Expected Behavior**
- Placement: right side, vertical stack; newest at top.
- Entry: animated appearance (descend from top).
- Exit: slide-out to the right.
- Queue: in-memory array; visual order reflects newest-first.
- Duration by severity:
  - Error: persistent (does not auto-dismiss), red shadow.
  - Warning: 10s, yellow shadow.
  - Notice: 5s, green shadow.
  - System/Loading: ≥3s; loading remains until explicitly ended, blue shadow.

**Scope**
- Add a central “message manager” class/service to own queue, timers, and IDs.
- Render via a single host in the app shell to show the stack on the right.
- Replace scattered notification logic to route through this class.
- No new dependencies; CSS-based animations only.

**Assumptions**
- “Hover message” refers to floating toast notifications, not tooltip/hover UI.
- Angular SPA; service + single host component is acceptable.
- Use existing design tokens (colors/shadows) where available.
- Callers can programmatically dismiss or update messages (e.g., loading → success).

**Constraints**
- Minimize changes to existing code; keep edits tightly scoped.
- Deliver a self-contained outcome without adding dependencies.
- Keep implementation achievable within a small diff and short timeframe.

**Unknowns**
- Presence of any existing notification/toast mechanism to extend or replace.
- Exact design tokens for red/yellow/green/blue and shadow intensities.
- Maximum number of concurrent on-screen messages.
- Whether a visible close button is required for sticky errors.
- Accessibility requirements (roles, aria-live, keyboard dismissal).
- Mobile behavior, safe-area padding, and z-index layering.

**Clarifying Questions**
- Should we replace any existing notification system, or integrate with it?
- Do you want a close button on persistent errors, or programmatic dismissal only?
- What color and shadow tokens should map to each severity (error/warn/notice/system)?
- Should we cap visible messages (e.g., 4) and queue the rest?
- Any accessibility requirements (aria-live/role, focus handling, keyboard support)?
- Any mobile-specific placement or safe-area constraints to observe?
- Is a simple API acceptable: showError, showWarning, showNotice, showLoading (returns id), update(id), dismiss(id), clearAll()?