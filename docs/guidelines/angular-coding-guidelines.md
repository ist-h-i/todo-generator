# Angular Coding & Design Guidelines

## Purpose & Scope
This document collects the coding, testing, and design-system expectations for the Angular single-page application. It expands the general repository rules documented in `general-coding-guidelines.md` with client-side specifics and design guardrails.

## Project Structure
- Keep shared infrastructure under `frontend/src/app/core`, reusable UI primitives under `shared`, and helpers under `lib`. Feature implementations belong to `features/<feature-name>` and use descriptive kebab-case folder names.
- Co-locate templates (`.html`), styles (`.scss`), and specs (`.spec.ts`) beside their component or service. Avoid creating global style files except for tokens and layout primitives in `frontend/src/styles/**`.
- Use standalone components with explicit imports. Register guards, interceptors, and feature services at the lowest viable scope to minimise bundle size.

## TypeScript & Coding Standards
- Enable `ChangeDetectionStrategy.OnPush` for components by default and rely on Angular signals or RxJS streams to trigger view updates.
- Do not use `any`. Prefer domain DTOs declared in `shared/models`, and accept `unknown` at unsafe boundaries (`JSON.parse`, `localStorage`) before narrowing with type guards.
- Keep services pure and idempotent. Wrap HTTP access through `core/api/**` and expose typed methods that return Observables with explicit generics (`HttpClient<T>`).
- Structure reactive forms with strongly typed `FormGroup` / `FormControl` definitions. Extract form helpers to `shared/utils` (e.g., `signalForms`) to encapsulate boilerplate.
- Use barrel files only when they improve clarity. Avoid circular imports by keeping feature modules self-contained.
- Leverage `takeUntilDestroyed(this.destroyRef)` for subscription cleanup in components and services.

## State Management & Data Flow
- Use Angular signals to represent local component state (`signal`, `computed`, `effect`). Keep long-lived cross-feature data in store classes under `core/state/**` and expose read-only selectors to components.
- When interacting with backend services, centralise optimistic updates and rollback logic in the store or gateway layer (`WorkspaceStore`, `AnalysisGateway`). Components should render state and delegate mutations to these abstractions.
- Maintain strict separation between presentation components (template + styling) and coordinators (components that orchestrate services or stores). Presentation components must receive inputs and emit outputs without direct API calls.

## Templates & Components
- Use descriptive selectors prefixed with `app-` for feature roots and `vy-` for shared primitives. Keep templates declarative and move conditional logic into getters or signals to aid testing.
- Prefer `ng-container` for structural directives to avoid unnecessary wrappers. Use `@if` / `@for` (Angular control flow) where available to simplify templates.
- Keep accessibility in mind: associate form labels, wire ARIA attributes, and ensure focus management for dynamic regions (drawers, dialogs, toasts).
- Localise user-facing copy through shared translation utilities. Avoid hard-coded English/Japanese strings in templates unless they are placeholders pending translation.

## Styling & Theming
- Follow the design tokens defined in `frontend/src/styles.scss` and reinforced in `docs/ui-design-system.md`. Reference tokens through CSS custom properties (e.g., `var(--surface-layer-1)`, `var(--space-lg)`) instead of hex values.
- Express elevation and emphasis with tone shifts and 1px borders. Drop shadows are disallowed; use `color-mix` or inset borders to convey depth consistently across light and dark themes.
- Respect the spacing scale (`space-xxs` ... `space-4xl`) and the layout rules defined in `docs/ui-layout-requirements.md`. Align grids to the defined breakpoints, and keep gutters responsive using `clamp()` where required.
- Reuse shared surface classes (`.surface-panel`, `.app-card`, `.page-state`) before introducing new styles. Component-specific SCSS should import `@use`d mixins/tokens rather than redefining values.
- Provide complete state styling (default, hover, active, focus, disabled). Ensure text/background contrast meets WCAG AA (>= 4.5:1 for body text, 3:1 for large text) in both light and dark modes. Document contrast ratios when adding or adjusting tokens.
- For icons and illustrations, prefer the shared asset set or CSS-based shapes. Avoid bitmap assets unless they ship in both 1x and 2x resolutions.

## Interaction & Accessibility
- Emit toasts and global error messages through the shared notification services (`HttpErrorNotifierService`, hover message stack). Do not create ad-hoc overlays.
- Preserve keyboard and screen-reader support: define `role`, `aria-live`, and `aria-describedby` where appropriate, and keep focus traps in dialogs/drawers.
- Support reduced motion preferences by honouring `prefers-reduced-motion` in animations and transitions. Keep animation durations <= 200ms.

## Testing Expectations
- Place component, pipe, and service specs next to their implementations as `*.spec.ts`. Use Angular Testing Library or Spectator to compose tests that focus on behaviour.
- Mock HTTP calls with Angular's `HttpTestingController` or fixture services. Cover error states, optimistic updates, and loading indicators for components that interact with stores or gateways.
- When introducing new components, add screenshot or storybook coverage if visual regressions are likely. Reference screenshots in PRs for any layout or theme change.

## Tooling & Commands
- Install dependencies with `npm install` inside `frontend/`, and rely on the package scripts: `npm run lint`, `npm run format:check`, `npm test -- --watch=false`, `npm run build`.
- Keep ESLint and Prettier configurations in sync with `angular.json` and project-level overrides. Update `tsconfig.*.json` when new compiler options are required, and document the rationale in the PR description.
- Use `npm run story:build` (if available) or manual component capture to produce UI evidence for design reviews.

## Delivery Checklist
1. Align implementation with design tokens and layout rules before opening a PR; request a design review for any deviation.
2. Verify light and dark themes, responsive breakpoints (mobile, tablet, desktop), and keyboard navigation.
3. Ensure new modules are lazy-loaded where appropriate and that route guards are updated when access requirements change.
4. Update the relevant design docs (`docs/ui-design-system.md`, `docs/ui-layout-requirements.md`) when tokens, components, or layouts evolve.



