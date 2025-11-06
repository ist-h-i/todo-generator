**Summary**
Unify the design of all “app-ui-selector” elements across the app. Use the existing designs for “Competency level” and “AI model selection” as the canonical reference, and update other selector UIs to match for a consistent look and behavior.

**Goals and Scope**
- Establish a single selector style (visuals + interaction) based on the two reference selectors.
- Apply across all screens where selectors are used.
- Minimize code churn by reusing or centralizing a selector component/style.

**Assumptions**
- “app-ui-selector” refers to dropdowns or option pickers used throughout the app.
- “Competency level” and “AI model selection” are implemented and considered the desired baseline.
- Frontend stack supports component reuse and shared styles (e.g., a common UI library, CSS variables, or utility classes).
- No functional changes to selection logic; only UI/UX consistency.

**Constraints**
- Avoid unnecessary tasks and keep changes minimal.
- Deliver a finished, self-contained outcome (no partial migrations).
- Maintain accessibility and keyboard navigation parity or better.

**Unknowns**
- Exact tech stack (React/Vue/etc.), styling system (CSS Modules, Tailwind, SCSS), and design tokens.
- The full inventory of screens/components currently using selectors.
- Variants needed (sizes, single vs multi-select, searchable, with icons, disabled/error states).
- Current accessibility level and any product-specific requirements (contrast, locales).

**Suggested Acceptance Criteria**
- Visual consistency: colors, typography, spacing, borders, radius, and icons match the reference selectors.
- Interaction states: focus/hover/active/disabled/error/loading consistently styled.
- Behavior consistency: keyboard navigation, clearable values, placeholders, helper/error text positioning.
- Accessibility: proper labels/ARIA roles; meets color contrast guidelines.
- Single source of truth: a shared selector component or style used by all screens; legacy styles removed or deprecated.
- Regression check: reference selectors unchanged in appearance and function.

**Residual Risks**
- Hidden selectors or edge-case variants missed without a complete inventory.
- Third-party components with limited theming causing inconsistencies.
- Potential regression in layouts if dimensions/paddings change.

## Clarifying questions
- Which framework and styling approach does the app use (e.g., React + Tailwind/SCSS, Vue, etc.)?
- Where are the “Competency level” and “AI model selection” selectors defined (file paths) to treat them as the canonical reference?
- Do we need to support variants (size, with icons/avatars, multi-select, searchable, inline vs modal)?
- Are there accessibility requirements or a design system (tokens, spacing scale, radius) we should align to?
- Should this create a single reusable component (e.g., `AppUiSelector`) or a shared style applied to multiple existing components?
- Any screens or components explicitly out of scope?
- Do we need RTL and i18n support adjustments for the selector layout?
- What is the preferred deprecation approach for existing selector styles (soft deprecate vs immediate replacement)?