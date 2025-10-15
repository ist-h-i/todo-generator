**Summary**
Implemented a dedicated HoverMessageService and refactored Shell to use it. This centralizes queueing, durations, and dismissal/animation logic for right-side, top-stacked hover/toast notifications with correct timing per severity.

**What Changed**
- Added a global service managing the message queue, timers, and API.
- Rewired Shell to read messages from the service and to publish notifications via the service.
- Preserved existing UI components and styles, including entry (drop-in) and exit (slide-out-right) animations, colors, and stacking.

**Files Touched**
- Added: frontend/src/app/core/layout/hover-messages/hover-message.service.ts:1
  - API:
    - `show(text, severity)`; convenience: `notify()`, `warn()`, `error()`, `loading()`, `system()`
    - `dismiss(id)`, `clearAll()`
    - `messages()` signal for rendering
  - Behavior:
    - Newest first (top)
    - Durations: error sticky, warning 10s, notification 5s, system 3s, loading sticky
    - Exit animation timing: 220ms, removal after animation
- Updated: frontend/src/app/core/layout/shell/shell.ts:20
  - Import service: `HoverMessageService`
  - Inject service: line 64
  - Expose messages: `hoverMessageList` reads from `this.hoverMessages.messages()` (line 109 before refactor; now resolved to service)
  - Replace internal toast logic with service:
    - Removed local queue, timers, and constants
    - `showProfileToast()` now calls `this.hoverMessages.notify(message)` (frontend/src/app/core/layout/shell/shell.ts:339)
    - Removed cleanup hook for local timers (service manages its own)

**Why This Meets The Issue**
- Right-side placement and vertical stacking are already implemented by existing components and styles.
- Entrance animation drops in from above; exit animation slides to the right per requirement.
- Queue is array-based; newest at top.
- Durations match:
  - Error: persistent (red shadow)
  - Warning: 10s (yellow shadow)
  - Notification: 5s (green shadow)
  - System/Loading: ≥3s (loading persists; blue shadow)
- Management class now exists and owns the logic (service), making it reusable across the app.

**Usage**
- Inject `HoverMessageService` and call:
  - `hoverMessages.notify('保存しました。')`
  - `hoverMessages.warn('注意が必要です。')`
  - `hoverMessages.error('エラーが発生しました。')` (sticky)
  - `const id = hoverMessages.loading('作成中…'); /* later */ hoverMessages.dismiss(id);`

**Commands (optional)**
- Build frontend: `cd frontend && npm run build`
- Dev server: `cd frontend && npm start`
- Tests: `cd frontend && npm test`

**Residual Risks / Open Questions**
- Manual dismissal UI for sticky errors is not present; currently requires programmatic dismissal. Do you want a close button per toast?
- Max visible toasts not enforced (all are shown). Should we cap (e.g., 4) and queue the rest?
- Exact design tokens (colors/shadows) assumed from existing CSS variables; verify they match DS expectations.
- Pause-on-hover and accessibility beyond current ARIA roles are not implemented; confirm if needed.