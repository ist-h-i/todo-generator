**Design Review Summary**
- Change is sound, minimal, and localized: replacing horizontal `flex` with `flex-col` in the subtask card container satisfies the requirement with minimal impact.
- Accessibility is preserved if DOM order places “status” before “content”; avoid using CSS `order-*` to flip visuals without changing reading order.
- Risk of unintended impact is low if scoped to the board’s subtask card template (not a shared component).

**External Impact**
- Height increase: cards may become taller; verify drag-and-drop hit areas remain stable.
- Tests/snapshots that assume DOM order may require minor updates.
- If older Safari must be supported and the app doesn’t already rely on `gap` for flex, add a tiny local fallback (see optional tweak).

**Concrete Diffs (Scoped, Minimal)**
Target (expected): `frontend/src/app/features/board/subtask-card/subtask-card.component.html`

1) Switch to vertical stack and ensure status precedes content
```
--- a/frontend/src/app/features/board/subtask-card/subtask-card.component.html
+++ b/frontend/src/app/features/board/subtask-card/subtask-card.component.html
@@
-<div class="flex items-start justify-between gap-2">
-  <!-- content -->
-  <div class="subtask-content /* keep existing truncation classes */">
-    {{ subtask.title }}
-  </div>
-  <!-- status -->
-  <app-status-badge [status]="subtask.status"></app-status-badge>
-</div>
+<div class="flex flex-col items-start gap-2">
+  <!-- status first for a11y -->
+  <app-status-badge [status]="subtask.status"></app-status-badge>
+  <!-- content below; keep existing truncation/wrapping classes -->
+  <div class="subtask-content">
+    {{ subtask.title }}
+  </div>
+ </div>
```

2) Optional (only if content should span full card width due to prior `justify-between` behavior)
```
--- a/frontend/src/app/features/board/subtask-card/subtask-card.component.html
+++ b/frontend/src/app/features/board/subtask-card/subtask-card.component.html
@@
-  <div class="subtask-content">
+  <div class="subtask-content w-full">
     {{ subtask.title }}
   </div>
```

3) Optional fallback for older Safari (only if your support matrix requires it and `gap` for flex isn’t already in use elsewhere)
```
--- a/frontend/src/app/features/board/subtask-card/subtask-card.component.html
+++ b/frontend/src/app/features/board/subtask-card/subtask-card.component.html
@@
-<div class="flex flex-col items-start gap-2">
+<div class="flex flex-col items-start gap-2">
   <app-status-badge [status]="subtask.status" class="mb-2 sm:mb-0"></app-status-badge>
   <div class="subtask-content w-full">
     {{ subtask.title }}
   </div>
 </div>
```

**Checks to Preserve Non-Functional Requirements**
- Keep existing truncation/wrapping classes on content (e.g., `truncate`, `line-clamp-*`, `break-words`) to avoid exposing more text than intended.
- Confirm the component is not reused broadly; if it is, gate this layout behind a local wrapper class or an `@Input()` flag set only by the board.
- Verify keyboard tab order reads status before content.
- Run `npm test -- --watch=false` and `npm run lint`/`npm run format:check` to ensure no regressions.

**Open Items (Minor)**
- Confirm exact template path and whether the status currently follows content in DOM.
- Confirm spacing preference remains `gap-2`.

**Recommendation**
- Proceed with the scoped template update above. This satisfies the requirements with minimal risk and maintains accessibility and performance.