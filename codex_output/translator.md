**English Summary**
Implement a lightweight “toast/notification” manager class that displays messages on the right side with animations, stacking newest at the top. Messages auto-dismiss based on severity with colored shadows; errors persist until dismissed, warnings after 10s, notices after 5s, and system/loading after ≥3s (loading persists until completion). Exit animation slides out to the right.

**Assumptions**
- “Hover message” refers to floating toast notifications, not hover-triggered UI.
- Angular SPA with a service + single host component is acceptable and minimal-impact.
- Visuals use existing design-system tokens (colors, spacing, elevation) where possible.
- Entrance: slide/fade-in; Stack: vertical, top-aligned; Exit: slide-out to right.
- Queue is an in-memory array; newest prepended; oldest visually lowest.
- Errors require manual dismissal (close button or API call).
- Loading messages return an ID so the caller can complete/dismiss/update them.
- Reasonable defaults: animation ~200–300ms; max concurrent toasts (e.g., 3–5) to avoid overflow.

**Constraints**
- Minimal diff; avoid broad refactors.
- Self-contained: works without extra infra; no network or new deps.
- Complete within ~30 minutes of implementation scope.
- Reuse design system styles; avoid custom theme sprawl.

**Unknowns**
- Existing toast/notification system in the app (to extend vs replace).
- Exact color tokens for red/yellow/green/blue and shadow usage.
- Max visible toasts and overflow behavior (queue vs drop oldest).
- Close affordance requirements (icon, click-to-dismiss, keyboard).
- Pause-on-hover requirement for auto-dismiss timers.
- Accessibility targets (ARIA roles: `alert`, `status`, `progressbar`; focus, screen readers).
- Mobile/responsive behavior, safe-area insets, and z-index layering.
- Internationalization and message content sources.
- Animation library preferences (pure CSS vs Angular animations).

**Clarifying questions**
- Can we confirm this is a toast system (not hover-triggered) and agree on the name (e.g., NotificationManager/ToastService)?
- Should we extend/replace any existing notification mechanism in the app?
- What design tokens (color, shadow/elevation) map to error/warn/info/loading?
- Do errors require a visible close button, or only programmatic dismissal?
- Should timers pause on user hover/focus for warnings/notices?
- What is the maximum number of on-screen messages before queuing?
- Any accessibility requirements to meet (roles, focus behavior, keyboard dismissal)?
- Do you want a simple service API like: showError, showWarning, showNotice, showLoading (returns id), update(id), dismiss(id)?
- Any mobile-specific placement or safe-area padding requirements?
- Preferred animation duration/easing and whether to use CSS only or Angular animations?

**Risks / Notes**
- Misalignment on design tokens or naming could cause rework.
- Replacing an existing toast system may introduce regressions without an audit.
- Accessibility and mobile behavior need explicit acceptance to avoid follow-up work.