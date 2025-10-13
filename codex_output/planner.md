Summary
- The frontend is Angular (standalone components), not React.
- Tailwind CSS and TypeScript are already configured.
- App-wide select styling is centralized in frontend/src/styles/pages/_base.scss and already implements a modern, vertically centered chevron.
- No shadcn or React structure exists; adding React/Radix would be invasive here.

Default Paths
- Components: frontend/src/app/shared/ui (existing shared UI components live here).
- Styles: frontend/src/styles.scss (Tailwind layers), frontend/src/styles/pages/_base.scss (central form/select rules).

Why not /components/ui
- /components/ui is a shadcn (React) convention used by its CLI and Next.js/Vite setups.
- In this Angular repo, creating /components/ui would fragment the UI layer and introduce React-only files that don’t compile. Keeping UI parts under frontend/src/app/shared/ui remains consistent, minimizes churn, and fits Angular’s module/standalone imports.

Minimal Integration Plan
- Create Angular Select UI component: frontend/src/app/shared/ui/select/select.ts (standalone, ControlValueAccessor).
  - Wraps native <select>, projects <option> children.
  - Applies existing classes form-control app-select so it inherits the new design.
  - Supports formControlName/ngModel, disabled, name, id, multiple.
- Replace current native selects (4 instances) with <app-ui-select> while preserving options:
  - frontend/src/app/features/reports/reports-page.component.html:255, frontend/src/app/features/reports/reports-page.component.html:274
  - frontend/src/app/features/admin/page.html:129, frontend/src/app/features/admin/page.html:425
  - Add UiSelectComponent to imports in their page .ts files.
- Keep global style coverage so any untouched selects still look correct (already done in _base.scss).

Dependencies
- Do not install @radix-ui/react-select or @radix-ui/react-icons (React-only).
- No new NPM packages required for Angular implementation.

If React/shadcn is required later
- Only applicable if a React app is present. Then:
  - Setup shadcn CLI, ensure Tailwind and TS configured.
  - Create /components/ui, add select.tsx and label.tsx, and @/lib/utils.ts (cn helper).
  - Install @radix-ui/react-select and @radix-ui/react-icons.
  - Not recommended in this Angular-only repo.

Risks
- Changing templates to use <app-ui-select> must maintain reactive forms behavior; CVA will address this.
- Multi-select and size>1 behavior should match CSS variants (component should pass the attributes through).

Questions
- Any multi-select use cases to support now?
- Should we add a size/density input (e.g., compact) or stick to current tokens?
- Any pages that must retain current native <select> markup (no component swap)?

Verification
- Build and smoke test the two pages (Reports, Admin): default/hover/focus/disabled, values bind correctly, keyboard/focus ring present, options render, icon is centered.
- Confirm any remaining native selects still look correct via the centralized CSS.

```json
{"steps":["coder","code_quality_reviewer","integrator"],"notes":"Implement an Angular Select UI component (standalone CVA) under frontend/src/app/shared/ui/select that wraps native <select> and applies existing classes (form-control app-select) to inherit the modern design already defined in _base.scss. Replace the 4 current native selects in Reports and Admin templates with the new component, preserving projected <option> content and reactive forms bindings. Do not introduce React/shadcn/Radix; this is an Angular repo with Tailwind and TS already set up. Keep centralized CSS so any remaining selects continue to match the new design.","tests":"- Compile frontend and run locally.\n- On Reports and Admin pages, verify: (1) component binds with formControlName (value/disabled/dirty/touched propagate), (2) options render and selection updates form state, (3) focus-visible ring and hover/disabled states match, (4) chevron icon remains vertically centered and spaced, (5) no regressions for any remaining native selects due to global styles."}
```