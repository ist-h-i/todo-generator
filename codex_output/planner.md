**Objective**
Add a centralized hover/toast message manager that stacks messages on the right, newest on top, with entry/exit animations and auto-dismiss per severity. Keep the change minimal and dependency-free.

**Lean Approach**
- Add a single service to own queue, timers, and IDs.
- Add a small host component to render right-side stacked toasts with CSS-only animations.
- Wire host into the shell template; route existing notifications through the service.
- No new dependencies; reuse existing design tokens.

**Key Behaviors**
- Order: newest at top; array-backed queue.
- Durations by severity:
  - Error: persistent (red).
  - Warning: 10s (yellow).
  - Notice: 5s (green).
  - System/Loading: ≥3s; loading persists until dismissed (blue).
- Animations: drop-in/slide-in on entry; slide-out-right on dismissal.
- API: showError, showWarning, showNotice, showLoading (returns id), update(id), dismiss(id), clearAll().

**Minimal Diff Integration**
- Prefer extending any existing notification/toast mechanism if present to avoid duplication.
- Insert a single host into the app shell; avoid broad refactors.
- Map severity to existing color/shadow tokens; keep CSS scoped.

**Risks / Unknowns**
- Existing notification system overlap (potential double toasts).
- Exact color/shadow tokens; may need tuning.
- Close button requirement for sticky errors not specified.
- A11y depth (aria-live, roles) and mobile safe-area/z-index not specified.

```json
{"steps":["coder"],"notes":"Single-stage (coder) is sufficient to add a central HoverMessageService and a lightweight host component, wire it into the app shell, and route notifications through it. No new dependencies; CSS-only animations. If an existing notification system exists, coder will extend/adapt it instead of replacing to keep the diff minimal.","tests":"Unit: verify queue order (newest first), per-severity durations (error sticky, warning 10s, notice 5s, system >=3s), loading returns id and persists until dismiss/update, dismissal triggers exit flag then removal after ~200–300ms. Manual: confirm right-side stack, slide-in entry and slide-out-right exit, colors/shadows per severity, timers behave as specified, errors and loading persist until explicitly dismissed/updated."}
```