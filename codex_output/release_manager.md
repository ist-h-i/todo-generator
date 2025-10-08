**Release Decision**
- Approve for release. Changes are minimal, self-contained, and align with the Angular + Tailwind + TypeScript stack in this repo. No new dependencies or build changes.

**Scope of Changes**
- Standardized native selects to the modern style with vertically centered trigger icon.
- CSS implements the design globally; one remaining template updated for consistent class usage.
- Files:
  - CSS: `frontend/src/styles/pages/_base.scss:85` — modern select styling, caret centered via `background-position: right … center`.
  - Template: `frontend/src/app/features/reports/reports-page.component.html:255` — added `app-select` to select class.

**Not in Scope (By Design)**
- No React/shadcn/Radix integration. The repo is Angular; introducing React components and `/components/ui` would add unused complexity and dependencies.

**Risks**
- Missed templates without `app-select` may look inconsistent (CSS still targets `select.form-control`, mitigating risk).
- RTL locales anchor caret to right; not yet mirrored.
- High-contrast/forced-colors modes may need a fallback to native indicator for visibility.

**Verification Checklist**
- Visual: All selects show centered caret, adequate right padding, consistent radius and focus ring.
- Pages: Settings, Reports, Analyze, Board, Admin — scan visible selects for consistency.
- States: Hover/focus rings, disabled opacity/cursor, error borders (if any).
- Multi-selects: No chevrons; padding/layout stable.
- Dark mode: Chevron visibility and contrast are acceptable.
- Mobile: Touch targets ≥44px; no overflow or clipped icon.

**Rollout Plan**
- Ship as a minor UI refinement; no migrations, no config changes.
- Communicate usage: ensure new/edited selects include `class="form-control app-select"`.

**Rollback Plan**
- If issues arise, revert template edits and/or temporarily disable the select-specific block in `frontend/src/styles/pages/_base.scss:85`.
- No dependency removals required.

**Open Questions**
- Do we need RTL support now? If yes, we will add `:dir(rtl)` overrides for caret position.
- Any custom non-native select widgets that should also adopt this style?