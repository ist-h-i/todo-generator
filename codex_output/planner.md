**Summary**
- Symptom: “Level” select in competency registration shows no options.
- Likely cause: Shared `app-ui-select` reads projected `<option>`s only once; misses options inserted or updated after initial render.

**Proposed Fix (Minimal)**
- Localize changes to `frontend/src/app/shared/ui/select/ui-select.ts`.
- Defer initial option read until after render completion (`queueMicrotask`, fallback `setTimeout(0)`).
- Add `MutationObserver` on the native/select host to refresh internal `options` when `childList/subtree/characterData/attributes` change.
- Implement `OnDestroy` to disconnect the observer.
- Preserve public API, bindings, templates, and UX.

**Why This Route**
- Single shared component fix unblocks the “Level” field and other pages.
- No contract changes or backend touches; lowest impact and fastest turnaround.

**Validation (Manual)**
- Admin → コンピテンシー登録 → “レベル” dropdown shows expected items; can select and submit; payload includes selected `level`.
- Spot-check other `app-ui-select` usages (e.g., reports/status, priority) for correct options, selection, keyboard, and ARIA behavior.
- Ensure no console errors.

**Residual Risks / Open Questions**
- If options come from an API and it returns empty, UI will still show none (backend issue).
- If labels depend on i18n keys, missing translations could render blank labels despite this fix.
- SSR/hydration contexts: ensure observer logic is browser-only (likely fine in current SPA views).

```json
{"steps":["coder"],"notes":"Implement minimal, shared fix in UiSelect by deferring initial options read and observing projected <option> mutations. No API/template changes. This restores the competency 'Level' options and stabilizes other selects.","tests":"Manual: (1) Admin → コンピテンシー登録 → verify 'レベル' options render and selection submits; (2) Spot-check other app-ui-select instances (reports status/priority) for proper rendering/selection; (3) Verify no console errors and accessible keyboard navigation remains."}
```