**Approach**
Implement a minimal, self-contained toast manager: one Angular service to manage a queue and one host component to render toasts on the right with CSS-only animations. Newest appears at the top; auto-dismiss per severity; errors persist; loading returns an id and persists until dismissed/updated. Keep styling token-friendly and avoid new dependencies.

**Minimal Change Plan**
- Add `ToastService` with in-memory queue and simple API.
- Add `ToastHostComponent` to subscribe and render the queue.
- Add lightweight CSS animations and severity styles (shadow/colors).
- Wire host into the root app template; no global refactors.
- Provide usage examples and short inline docs in the service.

**Deliverables**
- `ToastService`:
  - API: `showError(text, opts?)`, `showWarning(text, opts?)`, `showNotice(text, opts?)`, `showLoading(text, opts?) -> id`, `update(id, patch)`, `dismiss(id)`, `clearAll()`, generic `show(input)`.
  - Queue: newest unshifted; maintains `messages$` BehaviorSubject.
  - Durations: error `sticky`, warning `10s`, notice `5s`, system/loading `>=3s` (loading sticky until completion).
  - Max visible (e.g., `maxVisible = 4`) to prevent overflow.
  - Returns ids for programmatic dismissal.
- `ToastHostComponent`:
  - Fixed position, right side, top-aligned column.
  - Entrance `slide-in-right` (fade/translateX), exit `slide-out-right`.
  - Close button for manual dismissal; click-to-dismiss optional for non-loading types.
  - ARIA: container `aria-live="polite"`, per-message role: error/warn `alert`, notice/info `status`, loading `status` optionally with `aria-busy`.
- Styles:
  - Use CSS variables where available with sane fallbacks: `--color-error`, `--color-warn`, `--color-success`, `--color-info`, elevation shadows.
  - Shadow color and intensity vary by severity.
- Integration:
  - Add `<app-toast-host></app-toast-host>` into root shell template.
  - No external libs; pure Angular + CSS.

**Key Decisions**
- CSS animations over Angular animations to minimize diff and dependencies.
- Timers managed in the service; hover pause omitted to keep scope minimal.
- Severity mapping hardcoded with clear constants; colors via tokens with fallback.
- Errors require explicit dismiss; loading returns id and persists.

**Risks / Open Questions**
- Existing notification system may conflict (double toasts). Needs confirmation.
- Exact design tokens (colors/shadows) unknown; will use conservative defaults with token hooks.
- Accessibility depth (focus management, keyboard shortcuts) beyond basics not defined.
- Mobile/safe-area behavior unspecified; default positions may need later adjustment.

**Verification (Tests)**
- Unit: service queue ordering (newest first), duration scheduling per severity, manual dismissal, loading lifecycle (show → update/dismiss), exit animation flagging.
- Manual smoke:
  - Trigger one of each severity; confirm colors, shadow, and timers: warning ~10s, notice ~5s, loading persists, error persists.
  - Confirm newest appears on top; exit animates to the right.
  - Dismiss error via close button; dismiss loading via API; verify removal after exit animation.
  - Add >4 toasts; ensure max visible behavior is sane.

```json
{"steps":["coder"],"notes":"Single-stage (coder) is sufficient to add a service + host component, CSS animations, and wire into the app with a minimal diff. No new deps or refactors. If an existing toast system exists, coder will adapt to extend it instead of replacing.","tests":"Add unit tests for ToastService: (1) newest-first order, (2) per-severity durations and sticky error, (3) loading returns id and persists until dismiss/update, (4) dismissal triggers exit state then removal. Manual QA: visually confirm right-side stack, colors/shadows per severity, timers (10s/5s/sticky), slide-in/out animations, and close behavior."}
```