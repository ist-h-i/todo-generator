**Status**
- Dark-mode arrow now matches text color for both native selects and the shared Angular UiSelect. No additional code changes required.

**What Ensures The Match**
- UiSelect caret inherits text color:
  - `frontend/src/app/shared/ui/select/ui-select.ts:122` → `.ui-select__icon { ... color: currentColor; }`
  - Inline SVG uses `stroke="currentColor"`: `frontend/src/app/shared/ui/select/ui-select.ts:41`
- Native `<select>` caret inherits text color in both themes:
  - `frontend/src/styles/pages/_base.scss:106` → background SVG with `stroke='currentColor'`
  - Dark theme keeps the same approach: `frontend/src/styles/pages/_base.scss:167`

**Related Fix Already Applied**
- Template blur handler access error resolved: `onTouched` is public
  - `frontend/src/app/shared/ui/select/ui-select.ts:208` (public `onTouched`)

**Verify**
- Switch to dark mode and check:
  - UiSelect triggers: `frontend/src/app/features/reports/reports-page.component.html:255`, `:274`
  - Native selects: `frontend/src/app/features/settings/page.html:249`, `:428`, `frontend/src/app/features/board/page.html:565`, `:730`
- Build: `cd frontend && npm ci && npm run build`

**Notes on shadcn/React Select**
- This repo is Angular. Adding the provided React (Radix) Select would introduce a React runtime, which is out of scope for a minimal, safe change.
- If you later add a React sub-app:
  - Component path: `components/ui/select.tsx`, label at `components/ui/label.tsx`
  - Utils: `lib/utils.ts` for `cn`
  - Install: `@radix-ui/react-select`, `@radix-ui/react-icons`
  - Tailwind must be configured; shadcn’s default structure is `components/ui` for primitives.

**Next Step**
- If any instance still shows a mismatched icon in dark mode, point me to its file, and I’ll align it to use `currentColor` as above.