**Request Summary**
- Unify the visual design of all selectors (dropdowns) with text inputs.
- Fix hover: selector background turns white and diverges from inputs.
- Ensure the down-arrow icon is always visible (not only on hover).
- Maintain light/dark theme parity; in dark mode, icon color must match text color for contrast.
- Keep the change minimal, centralized, and safe to apply app‑wide.

**Assumptions**
- The repository is Angular-based; existing selectors include native `<select>` and a shared Angular UI select.
- A centralized SCSS/theming layer exists and should be the primary lever (no API/behavior changes).
- Style tokens (color, border, radius, focus ring) already define the input look we should match.
- The icon can inherit `currentColor` to remain in sync with text in both themes.
- Paths used historically: components like `src/app/shared/ui`, styles like `src/styles` (or similar).

**Constraints**
- Minimize scope and avoid template/TS changes unless necessary for correctness.
- Deliver a complete, self-contained fix affecting all selectors consistently.
- Complete within a small diff (single SCSS/CSS source preferred).
- Do not introduce React/shadcn into an Angular codebase.

**Unknowns**
- Exact selector implementations in use (native `<select>`, custom Angular `ui-select`, Angular Material, or a mix).
- The definitive input styling tokens to mirror (hover, focus, disabled, radius, border, bg).
- Any page-specific overrides that could conflict with centralized updates.
- RTL and high-contrast/forced-colors requirements.
- Target browser support (e.g., allowance for modern CSS like color-mix).

**Notes on React/shadcn Content Provided**
- The provided React/shadcn/Tailwind/TypeScript Select component and instructions are not applicable to this Angular repo as-is.
- If the project were React with shadcn:
  - Default components path is `/components/ui`, styles under `/lib` and Tailwind config.
  - Creating `/components/ui` standardizes imports and aligns with shadcn generators.
  - Required deps: `@radix-ui/react-select`, `@radix-ui/react-icons`; Tailwind and TS setup required.
- For this Angular repo, equivalent structure is typically `src/app/shared/ui` (components) and `src/styles` (global SCSS).

**Clarifying Questions**
- Which selector variants must be covered: native `<select>`, custom `ui-select`, `mat-select`, or all?
- Which input style tokens are the source of truth (bg, border, radius, hover, focus ring) to mirror exactly?
- Do any modules/pages require opt-out from the unified appearance?
- Are RTL and forced-colors (high contrast) modes in scope for this change?
- What are the target browsers (to confirm acceptable CSS features)?

**Proposed Acceptance Criteria**
- Selector idle, hover, focus-visible, and disabled states match inputs for bg/border/radius.
- Icon is always visible and uses `currentColor` to match text (light/dark).
- Hover no longer turns selector background white; visual feedback matches inputs.
- No behavior or API changes; minimal, centralized style diff; dark mode parity preserved.