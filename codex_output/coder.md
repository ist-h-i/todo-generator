I’ve reviewed the frontend and confirmed the root cause is in the shared select. I implemented the minimal fix in the shared component so the projected <option> elements are reliably discovered and kept in sync.

What I changed
- Stabilized app-ui-select to read options after render and on mutations, without changing its public API or templates.

Focused diffs
- frontend/src/app/shared/ui/select/ui-select.ts:1–16
  - Added OnDestroy to imports.
- frontend/src/app/shared/ui/select/ui-select.ts:182
  - Implemented OnDestroy on UiSelectComponent.
- frontend/src/app/shared/ui/select/ui-select.ts:205–231
  - Deferred initial option read to post-render using queueMicrotask (fallback to setTimeout(0)).
  - Added MutationObserver on the native select to watch childList/subtree/characterData/attributes and refresh options, selected label, and active index.
- frontend/src/app/shared/ui/select/ui-select.ts:233–238
  - Cleaned up MutationObserver in ngOnDestroy.
- Behavior preservation: No changes to inputs, form bindings, or templates. Keyboard and ARIA behavior remain intact.

Why this fixes “Level” options
- The admin “レベル” field uses projected static options: frontend/src/app/features/admin/page.html:129–132
- With deferred read + MutationObserver, the component now consistently discovers those options even when rendering timing varies, so the dropdown shows items and selection persists.

Key file references
- Shared select: frontend/src/app/shared/ui/select/ui-select.ts:205, 219, 233
- Admin “レベル”: frontend/src/app/features/admin/page.html:129–132
- Default value (junior): frontend/src/app/features/admin/page.ts:81, 242

Manual verification
- Admin → コンピテンシー登録:
  - Open “レベル” dropdown; see “初級 (3段階)” and “中級 (5段階)”.
  - Select both values; submit; payload includes selected level.
- Spot-check other selects (reports/status, priority, and admin evaluation selects) for populated options and selection.
- Optional commands (if deps are installed):
  - cd frontend && npm run lint
  - cd frontend && npm start

Residual risks / open questions
- If options are API-driven and return empty, UI will still show none (backend issue).
- If labels depend on i18n and keys are missing, labels could be blank despite this fix.
- In SSR/hydration contexts, MutationObserver should only run in the browser; current SPA views are client-only, but SSR views should be sanity-checked.