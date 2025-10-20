**Summary**
- Centralized UI notifications under HoverMessageService. Global loading and error banners in Shell are removed; messages now appear as animated toasts on the right, newest at top, per required durations and slide-out behavior.

**What I Changed**
- Routed global error and loading states into the hover/toast system via effects.
- Removed legacy header banners for loading and error to avoid duplication.
- Kept changes minimal and within existing hover-messages module.

**Files Updated**
- frontend/src/app/core/layout/shell/shell.html:3
  - Removed header banners (`.shell-global-loading`, `.shell-global-error`) and kept `<app-hover-message-stack [messages]="hoverMessageList()" />` as the single global outlet.
- frontend/src/app/core/layout/shell/shell.ts:101
  - Added `loadingToastId` to track the active loading toast id.
- frontend/src/app/core/layout/shell/shell.ts:215
  - Added effect to mirror `HttpErrorNotifierService.message` into sticky error toasts: `this.hoverMessages.error(msg)`.
- frontend/src/app/core/layout/shell/shell.ts:224
  - Added effect to mirror `HttpLoadingStore` into a persistent loading toast:
    - On `isLoading()`: if no toast, `this.hoverMessages.loading(message ?? 'データを読み込み中です…')`.
    - On end: `this.hoverMessages.dismiss(loadingToastId)` and reset.

**Existing Toast Implementation (for reference)**
- Service: frontend/src/app/core/layout/hover-messages/hover-message.service.ts:1
  - Durations: error sticky, warning 10s, notification 5s, system 3s, loading sticky; newest unshift; exit delayed by 220ms for animation.
- Host: frontend/src/app/core/layout/hover-messages/hover-message-stack.component.ts:1 and .html/.scss
  - Fixed top-right stack; `aria-live="polite"`, newest-first rendering.
- Item: frontend/src/app/core/layout/hover-messages/hover-message.component.ts:1 and .scss
  - Entry drop-in from top; exit slide-out right; severity styling with colored shadows.

**Why This Meets Requirements**
- Right-side stacking with animated entry and right-slide exit.
- Newest at top; array-backed queue.
- Severity-based durations:
  - Error: sticky (red).
  - Warning: 10s (yellow).
  - Notification: 5s (green).
  - System: 3s; Loading: persists until complete (blue).
- Global loading/error now fully managed by the service.

**Commands (optional)**
- Build: `cd frontend && npm ci && npm run build`
- Dev: `cd frontend && npm start`
- Tests: `cd frontend && npm test`

**Residual Risks / Open Questions**
- Sticky errors have no close button; dismissal is programmatic only. Add an inline close if needed.
- Successive errors will stack (no dedup). Define dedup or max visible if desired.
- We left unused CSS for old banners; harmless but can be cleaned up later.
- Timers don’t pause on hover; can be added if required.