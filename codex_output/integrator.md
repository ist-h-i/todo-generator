**Fix Applied**

- Made the template-called touch handler public so Angular AOT stops erroring.
  - Updated: frontend/src/app/shared/ui/select/ui-select.ts:52
  - Template call site: frontend/src/app/shared/ui/select/ui-select.ts:34
  - Details:
    - onTouched is declared as a public field and initialized: public onTouched: () => void = () => {};
    - registerOnTouched assigns the provided handler: frontend/src/app/shared/ui/select/ui-select.ts:60

**Why This Fix**
- Angular templates can only access public members. The build error TS2341 occurred because onTouched was private when referenced by (blur)="onTouched()".

**Selector Design Status**
- Centralized CSS for a modern, vertically centered single down-arrow caret is in place:
  - Styles: frontend/src/styles/pages/_base.scss:78
  - Uses inline SVG chevron, padded trigger, hover/focus/disabled, multi-select, and dark mode variants.

**React/shadcn Select (Prep Instructions)**
- This repo is Angular. If/when you add a React app (e.g., Next.js + Tailwind + shadcn):
  - Components path (shadcn convention): components/ui
  - Add files:
    - components/ui/select.tsx (provided Select)
    - components/ui/label.tsx (provided Label)
  - Ensure utility: lib/utils.ts exports cn(...)
  - Install deps: npm i @radix-ui/react-select @radix-ui/react-icons
  - Tailwind/shadcn setup: initialize Tailwind, shadcn CLI, and ensure tokens like bg-background, border-input are configured.

**Why components/ui**
- shadcn CLI scaffolds and docs assume components/ui, keeping primitives standardized and discoverable. It simplifies future component additions and consistency.

**Next Steps**
- Build Angular to confirm: cd frontend && npm ci && npm run build
- If you want, I can add a quick safeguard to use (blur)="onTouched?.()" and scan for other private members referenced in templates.

**Questions**
- Should the React Select be integrated now (in a separate React app), or just prepped for future?
- Any RTL or legacy browser constraints for the select visuals?
- Any modules that should retain current selector styling and be excluded?