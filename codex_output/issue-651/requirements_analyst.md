**Objective**
- Unify all “app-ui-selector” UIs across the app to match the existing “Competency level” and “AI model selection” selectors (visuals + interactions) with minimal code churn and no logic changes.

**Functional Requirements**
- Standardize visuals: colors, typography, spacing, borders, radius, and icons.
- Standardize interaction states: hover, focus, active, disabled, error, loading.
- Standardize behavior: placeholder text, clearable values (if present), helper/error text placement, keyboard navigation.
- Apply the standard across all screens/components using selectors within scope.
- Provide a single source of truth via a shared selector component or shared styles.
- Preserve existing selection logic and data flow.

**Non-Functional Requirements**
- Accessibility: proper labels/ARIA roles, focus management, and contrast compliance.
- Consistency: identical look/feel and interactions across contexts.
- Maintainability: centralized tokens/styles to prevent drift.
- Minimal impact: small, targeted changes; avoid large refactors or feature additions.

**Out of Scope**
- New selector features (e.g., adding search or multi-select) unless already implemented.
- Broader UI redesign beyond selectors.
- Backend/data model changes.
- Changes to non-selector components.

**Constraints**
- Avoid unnecessary tasks; minimize impact on existing code.
- Deliver a finished, self-contained outcome (no partial migrations).
- Do not alter appearance/behavior of the two reference selectors.

**Assumptions**
- “Competency level” and “AI model selection” are the canonical references.
- The stack supports reusable components or shared styles/tokens.
- Only styling/UX alignment is required; no behavioral or architectural change.
- Internationalization exists; labels come from existing i18n strings.

**Acceptance Criteria**
- Visual parity with reference selectors for colors, spacing, radius, typography, and icons.
- Consistent interactions: hover/focus/active/disabled/error/loading.
- Keyboard navigation and focus behavior consistent and accessible.
- A shared component/style exists and is adopted by all updated selectors.
- Legacy divergent styles removed or deprecated.
- No visual/functional regression to the two reference selectors.

**Dependencies**
- Access to source and styles for the two reference selectors.
- Inventory of screens/components using selectors.
- Availability or introduction of design tokens (colors, radius, spacing, typography).

**Residual Risks**
- Hidden or edge-case selectors not covered by the inventory.
- Third‑party components with limited theming, causing partial inconsistencies.
- Layout regressions from dimension/padding changes.
- Accessibility nuances differing across contexts (e.g., screen reader announcements).

**Clarifying Questions**
- What framework and styling system are used (e.g., React/Vue/Svelte; Tailwind/CSS Modules/SCSS)?
- Where are the “Competency level” and “AI model selection” selectors defined (file paths) to treat as canonical?
- Which selector variants must be supported (sizes, with icons/avatars, multi-select, searchable, inline vs modal)?
- Are there defined design tokens (colors, radii, spacing, typography) and an accessibility target (e.g., WCAG AA/AAA)?
- Should we implement a reusable `AppUiSelector` component or a shared style layer for existing components?
- Any screens/components explicitly out of scope?
- Do we need RTL support or special i18n layout rules?
- Preferred deprecation approach for old selector styles (soft deprecate vs immediate replacement)?