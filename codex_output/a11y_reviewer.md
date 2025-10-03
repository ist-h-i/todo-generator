**Summary**
- The subtask card now stacks Status above Content with vertical DOM order, which improves a11y and reading flow.
- Verified at frontend/src/app/features/board/page.html:261.

**What Passes**
- Visual/DOM order alignment: Status `span` precedes Title `h4` inside `flex flex-col` container (frontend/src/app/features/board/page.html:261–270).
- No CSS-only reordering; `justify-between` removed and `gap-2` retained, keeping tab/read order predictable.
- Page language declared `lang="ja"` (frontend/src/index.html:2).

**Potential Issues**
- Keyboard alternative for DnD: Subtask status appears changeable by drag only in the subtask board. A non-pointer method exists via the card detail drawer select (frontend/src/app/features/board/page.html:548–574), but there’s no direct control from each subtask card or an obvious link to open the parent card. This may hinder keyboard-only users (WCAG 2.1.1).
- Announcements on drop: No clear live announcement when a subtask is moved between columns (WCAG 4.1.3, 3.2.2).
- List semantics: Subtask cards render as `article`s in a `div` list (frontend/src/app/features/board/page.html:247–300). Lack of `role="list"`/`role="listitem"` or `ul/li` could reduce SR navigation clarity (WCAG 1.3.1).
- Contrast in dark mode: The status text uses `text-slate-500` at 11px (frontend/src/app/features/board/page.html:262–266). On dark surfaces this static Tailwind color may be insufficient; app-wide tokens handle theming better (WCAG 1.4.3).

**Recommendations**
- Keyboard fallback
  - Add a small, accessible “Change status” control on each subtask card (e.g., a `select` or button opening a menu) or a link to open the parent card’s editor focused on the status field.
  - Ensure it’s reachable via Tab and labeled (e.g., aria-label “ステータスを変更: {{ subtask.title }}”).
- Live feedback
  - Announce moves via an `aria-live="polite"` region (e.g., “『{{ subtask.title }}』を『{{ column.title }}』に移動しました”) triggered in `handleSubtaskDrop` (frontend/src/app/features/board/page.ts:307–320).
- Semantics
  - Mark the subtask list container as `role="list"` and each `article` as `role="listitem"`, or convert to `ul/li` for SR-friendly grouping (frontend/src/app/features/board/page.html:243, 248).
  - Add `aria-label` on the status text or wrap with contextual labeling if needed: “ステータス: {{ column.title }}” to reduce ambiguity.
- Contrast/theming
  - Replace `text-slate-500` with a design token class that adapts to themes, e.g., `text-muted` (frontend/src/styles.scss:218), for status/metadata text (frontend/src/app/features/board/page.html:262, 271, 278, 285, 290).

**Validation Notes**
- Layout change meets the requirement and improves reading order a11y.
- Addressing the keyboard alternative and live announcements will close the remaining WCAG gaps without broad refactors.