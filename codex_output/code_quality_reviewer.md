**Summary**
- Fix meets goal: dark-mode arrow inherits text color and remains visible.
- Scope is minimal (SCSS + existing Angular component styles), no behavior changes.

**What I Checked**
- Native/select styles use inline SVG caret with `stroke='currentColor'`: frontend/src/styles/pages/_base.scss:102
- Dark-mode sets `color` so caret inherits high-contrast text: frontend/src/styles/pages/_base.scss:164
- Caret positioning and spacing remain modern and centered: frontend/src/styles/pages/_base.scss:85, frontend/src/styles/pages/_base.scss:101
- Custom Angular select icon inherits `currentColor`: frontend/src/app/shared/ui/select/ui-select.ts:122
- Inline SVGs for trigger/check use `stroke='currentColor'`: frontend/src/app/shared/ui/select/ui-select.ts:56, frontend/src/app/shared/ui/select/ui-select.ts:86
- Multi/size variants hide caret: frontend/src/styles/pages/_base.scss:154

**Findings**
- In dark mode, `color: var(--text-primary)` ensures both text and caret use the same, high-contrast token: frontend/src/styles/pages/_base.scss:167
- The caret data-URI explicitly uses `currentColor` in both normal and dark modes, so it follows theme text color: frontend/src/styles/pages/_base.scss:102, frontend/src/styles/pages/_base.scss:174
- The Angular UI select trigger icon is styled with `color: currentColor`; SVG uses `stroke='currentColor'`, so it tracks text color as intended: frontend/src/app/shared/ui/select/ui-select.ts:122, frontend/src/app/shared/ui/select/ui-select.ts:56

**Edge Cases**
- Disabled state reduces opacity for the entire control, which will also dim the caret—consistent and acceptable: frontend/src/styles/pages/_base.scss:138
- Multi-select/size>1 removes the caret; unaffected by the change: frontend/src/styles/pages/_base.scss:154
- Focus-visible and hover states preserved in both light/dark modes: frontend/src/styles/pages/_base.scss:127, frontend/src/styles/pages/_base.scss:177, frontend/src/styles/pages/_base.scss:186

**Lightweight Suggestions (Optional)**
- High-contrast mode: consider hiding the background-image caret to avoid UA overrides causing poor visibility similar to the custom icon rule already present: add an equivalent `@media (forced-colors: active)` rule for `.app-select, select.form-control`.
- RTL: current `background-position: right 1.6rem center` is physical; if RTL is needed, add a small `[dir='rtl']` override to position the caret on the left.

**Verdict**
- Approve. The dark-mode arrow now matches the text color via `currentColor`, fixing visibility while keeping the change minimal and centralized.