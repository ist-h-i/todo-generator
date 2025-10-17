**Summary**
- Fixed the “level” select options not showing by stabilizing `app-ui-select` to read projected options after render and react to changes. The fix is localized to the shared select component with no public API changes.

**Changes**
- Updated `frontend/src/app/shared/ui/select/ui-select.ts:11` to import `OnDestroy`.
- Updated `frontend/src/app/shared/ui/select/ui-select.ts:182` to implement `OnDestroy` on the class.
- Added a deferred initial options read and a `MutationObserver` to refresh options when projected `<option>` elements change:
  - `frontend/src/app/shared/ui/select/ui-select.ts:205`
  - Defer with `queueMicrotask` or `setTimeout(0)` fallback.
  - Observe `childList`, `subtree`, `characterData`, and `attributes`.
  - On mutation: `readOptions()`, `syncLabelFromValue()`, `ensureActiveIndex()`.
- Cleanup observer on destroy:
  - `frontend/src/app/shared/ui/select/ui-select.ts:233`

What this fixes
- The competency “level” field uses `app-ui-select` with static `<option>`s at `frontend/src/app/features/admin/page.html:129`. With the observer and deferred initial read, the component correctly discovers and renders options even when content is added/updated after init (e.g., structural directives, async data, or timing differences).

**Key File References**
- Shared select component: `frontend/src/app/shared/ui/select/ui-select.ts:205`
- Admin level field usage: `frontend/src/app/features/admin/page.html:129`

**Why this is minimal**
- One shared component fix unblocks all uses of `app-ui-select` (admin, reports, etc.).
- No template API changes; no backend changes.

**How to Validate**
- Manual checks:
  - Admin → コンピテンシーを登録 → Verify “レベル” dropdown shows:
    - 初級 (3段階), 中級 (5段階) — `frontend/src/app/features/admin/page.html:129`
  - Select a level and submit; confirm form submission payload includes selected `level`.
  - Reports page: verify `status` and `priority` selects populate and are selectable (dynamic and static).
- Optional commands:
  - `cd frontend && npm run lint`
  - `cd frontend && npm test`
  - `cd frontend && npm start` then test via browser.

**Residual Risks / Open Questions**
- If an API was intended to supply options (not the case for the admin “レベル” field), an empty response would still render no options; this change doesn’t mask backend issues.
- If SSR/hydration is used elsewhere, the `MutationObserver` is guarded but those views should be sanity-checked.
- Extremely old browsers without `queueMicrotask` are handled via a `setTimeout` fallback; Angular’s evergreen policy makes this low risk.
- If option attributes change very frequently, the observer could trigger often; current usage patterns are light.