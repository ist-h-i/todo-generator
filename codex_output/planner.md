Plan summary

- Stack confirmation: The repo is Angular, not React. The provided shadcn/Radix React Select is not applicable here without a stack shift. We’ll implement a minimal, centralized SCSS fix.
- Problem focus: On hover, the select background turns too light (perceived “white”), diverging from other inputs. Unify hover behavior to match inputs with minimal UI drift.
- Scope control: Single-file SCSS changes, no TS/template edits, no deps, no React setup.

What to change

- Keep select hover background consistent with inputs:
  - Light theme: Remove or reduce the hover background lightening so it no longer jumps to white-ish; keep subtle border/box-shadow refinement only.
  - Dark theme: Do the same (avoid brightening the background on hover).
- Preserve existing tokens:
  - Radius, border, focus ring, transitions, and currentColor-driven caret remain unchanged.
- No changes to Angular component logic or assets.

Where to change

- Update the select hover rules in the central stylesheet:
  - frontend/src/styles/pages/_base.scss:118
  - frontend/src/styles/pages/_base.scss:177
- Optional alignment (if needed for total parity): If inputs use no hover background change at all, set the select hover background-color equal to its base background or remove the hover-specific background-color line entirely; keep border-color/box-shadow adjustments for tactile feedback.

Why this is minimal and safe

- Single-point change applied across `.app-select` and `select.form-control`.
- No behavior or API changes; no component churning.
- Matches existing design tokens and keeps dark mode parity.
- Leaves the modern, simple chevron (currentColor) intact, protecting the earlier fixes for icon visibility.

Risks and mitigations

- Risk: Some screens might have local overrides. Mitigation: central change should dominate; if conflicts surface, adjust specificity minimally.
- Risk: Perception of reduced hover affordance if background no longer brightens. Mitigation: keep subtle border/box-shadow change on hover for feedback.

Test plan

- Build: `cd frontend && npm ci && npm run build` or `ng build --configuration production`.
- Manual checks (light/dark):
  - Hover no longer jumps to white; background remains aligned with inputs.
  - Focus-visible ring shows correctly; disabled state unchanged.
  - Icon remains visible and matches text color (currentColor).
- Pages to spot-check:
  - frontend/src/app/features/settings/page.html:249
  - frontend/src/app/features/settings/page.html:428
  - frontend/src/app/features/board/page.html:565
  - frontend/src/app/features/board/page.html:730
  - frontend/src/app/features/reports/reports-page.component.html:274

Note on shadcn/React path

- Current repo is Angular. If you want the shadcn/Radix Select:
  - Requires a React + Tailwind + shadcn setup, `components/ui` convention, `@/lib/utils` `cn` helper, and packages `@radix-ui/react-select` and `@radix-ui/react-icons`.
  - This would be a separate, larger change, not advisable under the “minimal impact” and 30-minute constraints.

```json
{"steps":["coder"],"notes":"Centralize the fix by adjusting select hover styles in frontend/src/styles/pages/_base.scss to stop the background from turning white. Align hover behavior with inputs: keep subtle border/box-shadow feedback, remove or reduce hover background lightening in both light and dark themes. No TS/template changes, no new deps, retain currentColor chevron.","tests":"Build the frontend and manually verify on Settings, Board, and Reports pages that: (1) hover background no longer turns white; (2) focus-visible ring and disabled states remain correct; (3) dark mode remains readable; (4) caret icon color matches text (currentColor) and remains visible; (5) no regressions for multi-select/size>1."}```