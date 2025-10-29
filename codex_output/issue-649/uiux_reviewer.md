**Summary**
- The Competency Levels UI is now under コンピテンシー and removed from API・日次上限. Placement and flow look coherent and consistent with the existing design system.
- Key locations: コンピテンシーレベル section header at `frontend/src/app/features/admin/feature/admin-page.component.html:205`; Settings tab now only includes Gemini API and Default Limits at `frontend/src/app/features/admin/feature/admin-page.component.html:480` and `frontend/src/app/features/admin/feature/admin-page.component.html:527`.

**Placement & IA**
- Levels appear below “コンピテンシーを登録,” reducing context switching when creating competencies.
- The remaining “API・日次上限” tab focuses solely on API credentials and default limits, which clarifies tab scope.

**Accessibility & Keyboard**
- Tabs use buttons with `[aria-pressed]` and work via click; not ARIA-tab semantics but acceptable given scope. Consider future upgrade to `role="tablist"`/`role="tab"` for screen readers.
- Headings are logical: page `h1`, section `h2`, inner `h3` in criteria. Levels section uses `h2` appropriately.
- Labels are present and descriptive; global error/feedback banners use `role="alert"`/`role="status"` appropriately.

**Visual & Content**
- Visual hierarchy is clear: section headers + subtitles, list before form. The “レベルを追加” button uses a secondary style, which fits its subordinate action.
- Empty state for levels is present and helpful. Badge and meta text present essential attributes (段階数, 識別子).
- i18n appears consistent with existing Japanese copy.

**Behavior Checks**
- Creating a level updates the levels list and computed select options for the competency form (via signals). The competency “レベル” select does not auto-select the newly created level; current value remains valid, which is acceptable and predictable.
- A single `loading()` flag disables actions appropriately during async operations.

**Minor UX Opportunities (Non‑Blocking)**
- Discoverability: Add an anchor `id="competency-levels"` to the levels section (`frontend/src/app/features/admin/feature/admin-page.component.html:205`) and a small link near the competency “レベル” label like “レベルを管理” that jumps to it, aiding users who need a new level mid‑creation.
- Post‑submit focus: After adding a level, keep focus on the first input in the levels form or announce via live region to improve keyboard flow.
- Inline validation: If consistent with the design system, consider showing per‑field messages (in addition to required attributes) for faster correction.

**Risks**
- Deep links or internal docs pointing to the old section under “API・日次上限” will no longer land on Levels.
- Layout/spacing may shift slightly due to new container context; verify on small screens to ensure two‑column grids stack gracefully.
- Any E2E/analytics selectors that targeted the old location may need updates.

**Open Questions**
- Did the previous UI include edit/delete for levels? The current section lists and creates levels but has no edit/delete controls. If they existed before, we should re‑add them here; if not, current scope is correct.
- Do you want an anchor link from the competency “レベル” field label to the new section for quicker navigation?
- Should we add an `id="competency-levels"` to support future deep links?