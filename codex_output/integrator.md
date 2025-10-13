**Summary**
- Modernized the select options panel and finalized the trigger icon alignment.
- Kept changes minimal and Angular‑native; no new deps or framework shifts.

**What Changed**
- Updated `frontend/src/app/shared/ui/select/ui-select.ts:1`:
  - Hidden native select is now unfocusable/hidden to AT: adds `tabindex="-1" aria-hidden="true" inert`.
  - Options panel styling: rounded radius, subtle border, elevated shadow, smooth open animation, constrained max-height with scrolling.
  - Keyboard UX polish: visual “active” state for the focused option (`.is-active`) + focus-visible outline; dark-mode variants included.
  - Retains simple down chevron SVG on the trigger, centered and modern.

**Why**
- “Make the options panel modern” while keeping scope small and consistent with existing SCSS tokens.
- Fixes prior a11y/focus issue where the hidden native select could still be focused.

**Verify**
- Build frontend and smoke test Admin/Reports pages using `<app-ui-select>`:
  - Trigger renders a simple, centered down chevron with balanced spacing.
  - Panel opens below the trigger with rounded corners, shadow, clean hover/selected/active states, proper z-index, and smooth animation.
  - Keyboard: ArrowUp/Down moves the active row, Enter selects, Esc closes; focus ring visible.
  - Hidden native select no longer receives focus.

**Project Paths / Stack**
- This repo is Angular + SCSS; shared UI lives under `frontend/src/app/shared/ui/` and base styles under `frontend/src/styles/`.
- React/shadcn is not introduced to avoid scope creep. For React projects, default paths would be `/components/ui` with Tailwind and `@/lib/utils`; not applicable here.

**Optional Follow‑ups (low effort)**
- Scroll active option into view on open/arrow navigation.
- Add Home/End keys and `aria-activedescendant` wiring for full ARIA polish.

If you want, I can implement the active-item scroll and Home/End keys next.