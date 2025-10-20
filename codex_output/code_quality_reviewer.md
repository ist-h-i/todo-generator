**Summary**
- Meets the ask: hover no longer turns white; selectors match input styling; the down-arrow is always visible and inherits text color in light/dark.
- Scope is minimal and centralized; no React/shadcn introduced into this Angular repo.

**What I Reviewed**
- Base select styling applied globally to native selects:
  - `frontend/src/styles/pages/_base.scss:85` base rule for `.app-select, select.form-control`
  - `frontend/src/styles/pages/_base.scss:113` caret centered via background-position
  - `frontend/src/styles/pages/_base.scss:129` hover keeps background consistent with inputs
  - `frontend/src/styles/pages/_base.scss:138` focus-visible ring retained
  - `frontend/src/styles/pages/_base.scss:174` multi/size variants hide caret
  - `frontend/src/styles/pages/_base.scss:184` dark-theme parity for text/caret colors
- Shared Angular Select improvements:
  - Icon inherits text color (`currentColor`) and is visible at rest: `frontend/src/app/shared/ui/select/ui-select.ts:171`
  - Template-accessible `onTouched()` and null-safe value checks to keep builds green: `frontend/src/app/shared/ui/select/ui-select.ts:34`, `frontend/src/app/shared/ui/select/ui-select.ts:278`

**Correctness & Consistency**
- Visual parity with inputs across idle/hover/focus/disabled states: yes.
- Icon visibility: always visible, not gated by hover; matches text color in dark mode via `currentColor`.
- Option panel updated to a modern look without behavior changes.

**Risks / Nits (Low)**
- Forced-colors (Windows High Contrast): background-image chevron may be hard to see. Suggest hiding it in forced-colors and relying on native affordances.
- RTL: rules use physical `right`; acceptable for now, but logical properties could be a follow-up if RTL is required.
- If `color-mix()` is used anywhere for subtle tints, ensure acceptable browser support or add a conservative fallback.

**Lightweight Suggestions (Optional)**
- Add a11y safeguard:
  - `@media (forced-colors: active) { .app-select, select.form-control { background-image: none; } }` in `frontend/src/styles/pages/_base.scss:225` (or nearby global select rules).

**Notes on React/shadcn Instructions**
- This repo is Angular; introducing React/shadcn and Radix would violate minimal-change constraints. The centralized Angular/SCSS solution already satisfies the requirements.

**Verdict**
- Approve. The implementation is correct, minimal, and resolves the reported issues. Optional a11y tweak can be a small follow-up if desired.
