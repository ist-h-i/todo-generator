**Summary**
- Stack Status above Content in subtask cards by switching the header container to vertical layout and aligning DOM order with visual order.
- Minimal, localized Tailwind class change and element reorder; no behavior changes.

**Scope Check**
- Target only Board subtask cards in `frontend/src/app/features/board/page.html:261`.
- Applies across all breakpoints; keeps `gap-2`, removes `justify-between`.

**Design Rationale**
- Use `flex flex-col items-start justify-start gap-2` for compact vertical stacking.
- Place Status before Content in DOM for correct a11y reading/tab order and to avoid CSS-only reordering pitfalls.

**Risks**
- If any test or selector depends on sibling order within this container, it may need updating. No other shared usage observed.

**Concrete Diff**
```diff
--- a/frontend/src/app/features/board/page.html
+++ b/frontend/src/app/features/board/page.html
@@ -261,13 +261,13 @@
-                    <div class="flex items-start justify-between gap-2">
-                      <h4 class="min-w-0 break-words text-sm font-semibold text-on-surface">
-                        {{ subtask.title }}
-                      </h4>
-                      <span
-                        class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
-                      >
-                        {{ column.title }}
-                      </span>
-                    </div>
+                    <div class="flex flex-col items-start justify-start gap-2">
+                      <span
+                        class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
+                      >
+                        {{ column.title }}
+                      </span>
+                      <h4 class="min-w-0 break-words text-sm font-semibold text-on-surface">
+                        {{ subtask.title }}
+                      </h4>
+                    </div>
```

**Validation Notes**
- Visual: Status appears above title with ~`gap-2`; no vertical stretching from `justify-between`.
- A11y: Screen reader/tab order is Status → Title.
- Responsiveness: Check mobile/tablet/desktop for wrapping; no overflow expected.
- Regression: Other cards/views unaffected; only this container changed.

If you’d like, I can apply this patch and run `npm test`/lint locally.