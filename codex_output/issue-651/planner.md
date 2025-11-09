**Plan Overview**
- Create a single selector look-and-feel using “Competency level” and “AI model selection” as the canonical reference.
- Implement with minimal churn by introducing a shared selector (component or style layer) and refactoring other selectors to consume it.
- Preserve behavior; focus on visual/interaction consistency and accessibility.

**Execution Sequence**
- Requirements: confirm tech stack, locate reference selectors, determine required variants.
- Design: extract tokens (colors, radius, spacing, typography), states (hover/focus/active/disabled/error/loading), and behaviors (placeholder, clearable, helper text).
- Build: implement shared selector (or shared style) mirroring reference implementations, then replace usages incrementally.
- Review: verify visual parity and interactions (UI/UX) and accessibility compliance.
- Verify: functional confirmation on affected screens; ensure references unchanged.

**Why These Stages**
- requirements_analyst: Resolve unknowns and lock scope to avoid churn.
- detail_designer: Translate references into reusable tokens/props and state matrix.
- coder: Implement shared selector/style and refactor consumers.
- uiux_reviewer: Validate visual and interaction consistency.
- a11y_reviewer: Ensure ARIA/keyboard/contrast are correct.
- implementation_reviewer: Sanity-check integration and regressions without over-adding process.

**Deliverables**
- Shared selector component/style with tokens and state styling.
- Refactor of all in-scope selectors to use shared source.
- Brief usage notes for future contributors.

**Residual Risks**
- Hidden selectors or edge cases missed during inventory.
- Third‑party components with limited theming causing partial inconsistencies.
- Layout shifts due to padding/height changes.

**Open Questions**
- What framework and styling system are used?
- File paths for the “Competency level” and “AI model selection” selectors?
- Required variants (size, icons, multi-select, searchable)?
- Any design tokens to align with, and a11y target (WCAG level)?
- Any screens/components explicitly out of scope?

```json
{"steps":["requirements_analyst","detail_designer","coder","uiux_reviewer","a11y_reviewer","implementation_reviewer"],"notes":"Lean route focused on clarifying scope, defining a reusable selector spec, implementing a shared component/style, and validating UI/UX and accessibility. Skips heavy process (design_reviewer, performance, security, release) to minimize churn while meeting visual and a11y constraints.","tests":"1) Visual parity: side-by-side compare with reference selectors; check colors, spacing, radius, typography, icons. 2) Interaction states: hover/focus/active/disabled/error/loading on both light/dark if applicable. 3) Keyboard: Tab/Shift+Tab focus order; Arrow keys navigation; Enter/Escape behavior; clearable action focusability. 4) Accessibility: label association, ARIA roles/attributes, focus outline visibility, announcements; contrast >= WCAG AA. 5) Functional: selection changes propagate; placeholders and helper/error text positions match; no console errors. 6) Regression: confirm reference selectors unchanged in appearance and behavior."}
```