# Angular Coding & Design Guidelines

## Purpose & Scope

This guide records the Angular-specific coding, architecture, and testing expectations for the single-page application. It extends `../governance/development-governance-handbook.md` and aligns the team on the Angular v20 baseline, folder layout, and design guardrails.

## Angular v20 Baseline

- Ship new features with `standalone` components, directives, and pipes. Keep `NgModule` usage only where legacy integration cannot be refactored yet.
- Configure zone-less change detection with `provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true, polyfill: false })` and ensure new code does not depend on `NgZone`.
- Model UI reactivity with Signals (`signal`, `computed`, `effect`) and prefer the control-flow syntax (`@if`, `@for`, `@switch`, `@let`) over the legacy structural directives.
- Use the modern `input()` and `output()` helpers and mark inputs as `required` when the contract demands it.
- Default to strongly typed Reactive Forms, use `@defer` to stage non-critical rendering, and apply `ngOptimizedImage` for media delivery.
- Adopt the application builder (`@angular-devkit/build-angular:application`) with ESBuild optimisations and CLI budgets enabled by default.

## Project Structure

- Source root: `frontend/src/app`.
- `app/app.routes.ts` contains only the root routes. Feature routes live in `features/**/routes.ts` and load via `loadChildren` or `loadComponent`.
- `app/core/`: singleton services (configuration, logging, authentication), HTTP interceptors, guards, providers, and environment wiring.
- `app/shared/`: reusable UI primitives, directives, pipes, and helpers. Keep this layer presentation focused and side-effect free.
- `app/features/<feature-name>/`: feature slices organised as:
  - `data/`: API clients, data-access services, DTO mappers, validators.
  - `state/`: facades, signal stores, selectors, and side-effect orchestration.
  - `ui/`: feature presentation components, directives, and pipes.
  - `routes.ts`: exports the feature `Route[]`.
  - `testing/` (optional): feature-specific mocks and test harnesses.
- `app/testing/`: cross-feature testing utilities and global mocks.
- Co-locate HTML, SCSS, and spec files with their component or service. Restrict global CSS to tokens and layout primitives inside `frontend/src/styles/**`.

## Architecture & State Management

- Follow Clean Architecture boundaries: UI -> facade/state -> data-access -> external API.
- Keep presentation components dumb: accept inputs, emit outputs, and delegate business rules to facades. Do not invoke HTTP clients directly from UI components or templates.
- Prefer Angular Signal Store (`@angular/core/rxjs-interop`) for feature-level state. Use NgRx ComponentStore only for complex orchestration or when integrating with existing NgRx code.
- Expose readonly signals/selectors from facades and keep mutations encapsulated behind intention-revealing methods.
- Validate API payloads in `data/` using schema libraries such as `zod` or `typia` before persisting data in the store.
- Represent remote lifecycles with `signalResource`, `rxResource`, or discriminated unions like `'idle' | 'loading' | 'success' | 'error'`. Centralise optimistic update and rollback logic.
- Use `effect()` for side effects, and pair with `onCleanup` when registering external listeners to avoid leaks.

## TypeScript & Coding Standards

- Enable strict compilation: `strict`, `noImplicitOverride`, `useUnknownInCatchVariables`, `noUncheckedIndexedAccess`.
- Prefer `inject()` utilities for dependency resolution. Constructor injection is acceptable when upgrading legacy classes but not the default.
- Avoid `any`. Accept `unknown` at unsafe boundaries and narrow with guards or schema validation. Keep framework-mandated `any` signatures isolated.
- Bridge RxJS with Signals using `toSignal`, `fromObservable`, or `model()`. Avoid manual `subscribe`; when unavoidable, wrap with `takeUntilDestroyed()` and document the reason.
- Give callbacks explicit return types (including `void`) and mark member visibility consistently.
- Follow naming conventions: `camelCase` for locals, `PascalCase` for types and components, `UPPER_SNAKE_CASE` for constants. Append the `Signal` suffix when the purpose is not obvious.
- Configure ESLint with `@angular-eslint` v20 presets, enforce import ordering (Angular -> third-party -> internal), and block unused imports or variables.
- Create barrel files only when they improve clarity without increasing coupling or cycle risk.

## Templates & Components

- Use selectors prefixed with `app-` for feature components and `shared-` for cross-application primitives.
- Prefer the modern control-flow syntax (`@if`, `@for`, `@switch`, `@let`) and wrap conditional fragments in `ng-container` to avoid unnecessary DOM nodes.
- Express view state with signals instead of mutable class fields or `markForCheck`.
- Bake accessibility in: wire `aria-*` attributes, label controls, manage focus traps in dialogs, and keep keyboard support intact.
- Localise user-facing text through the shared translation utilities or `i18n` attributes. Do not hard-code strings outside placeholders.
- Gate non-critical content behind `@defer` with `on viewport` or `on interaction`, and provide skeleton or busy states while deferred areas load.

## Styling & Theming

- Use design tokens defined in `frontend/src/styles.scss` and `docs/ui-design-system.md` via CSS custom properties. Avoid hard-coded hex values.
- Scope component styles with `:host`, `:host-context`, and CSS layers. Import mixins or variables instead of re-declaring values.
- Respect the documented spacing and typography scale, use `clamp()` for responsive sizing, and align grids with published breakpoints.
- Provide full interaction states (default, hover, active, focus, disabled). Ensure WCAG AA contrast in both light and dark themes and record ratios when changing tokens.
- Prefer vector icons from the shared library. Add new assets only when the shared set lacks the required graphic.

## Testing & Quality Gates

- Co-locate unit tests with their source files. Use Angular Testing Library or the Angular `TestBed` `mount` API for standalone components.
- Mock HTTP dependencies with `HttpTestingController` or feature-specific fakes. Cover success, failure, and optimistic update scenarios.
- Assert signal-driven behaviour via the exposed signals or effects rather than internal implementation details.
- Maintain coverage thresholds of at least 90 percent for statements, branches, functions, and lines. Enforce coverage in CI.
- Use Playwright for end-to-end tests covering critical user journeys, SSR hydration, and key accessibility flows.
- Provide Storybook v8 stories or visual snapshots for components with meaningful UI to catch regressions early.

## Tooling & Developer Experience

- Scaffold code with CLI generators (for example `ng g @angular/core:component --standalone --inline-style=false --flat=false`) to keep conventions consistent.
- Standard scripts (run from `frontend/`): `npm run lint`, `npm run format:check`, `npm test -- --watch=false`, `npm run build`, `npm run e2e`.
- Enable the Angular CLI build cache and ESLint cache to shorten feedback loops locally and in CI.
- Record architecture decisions in `docs/adr` and update entries when new patterns or dependencies are introduced.
- Keep Storybook (`npm run storybook`, `npm run story:build`) aligned with feature work and attach UI evidence to review requests.

## Performance & Delivery

- Lazy-load features with `loadChildren` or `loadComponent` and combine with `@defer` for progressive loading. Trigger deferred sections with `on viewport` or `on interaction`.
- Use build optimizer, ESBuild, and CLI budgets (initial bundle, lazy chunk, CSS). Monitor budget regressions in CI.
- Optimise media with `ngOptimizedImage`, specify `priority` hints when needed, and defer analytics to `requestIdleCallback`.
- Implement SSR with `@angular/ssr`, enable signal hydration, and validate boundaries in end-to-end tests. Consider the View Transitions API for smoother route changes.
- Track Web Vitals and ship metrics through the shared logging infrastructure.

## Interaction & Accessibility

- Route global notifications through the shared services; avoid bespoke overlays.
- Honour `prefers-reduced-motion` and keep animations at 200 ms or faster unless accessibility requirements dictate otherwise.
- Ensure dialogs declare appropriate `role`, `aria-modal`, and focus handling. Provide visible focus states and skip links for long layouts.

## Security

- Sanitize `[innerHTML]` bindings via `DomSanitizer` and avoid bypassing Angular security contexts without review.
- Centralise authentication, authorisation, and logging responsibilities in interceptors or guards inside `app/core/`. Align CSRF and credential handling with backend expectations.

## Delivery Checklist

1. Confirm alignment with design tokens, layout rules, and accessibility requirements before opening a PR.
2. Run `npm run lint`, `npm test -- --watch=false`, `npm run build`, and `npm run e2e`; attach relevant reports to the PR.
3. Validate responsive breakpoints, dark mode, SSR hydration, and signal-driven UX scenarios locally.
4. Update `docs/ui-design-system.md`, ADRs, and feature READMEs when introducing tokens, patterns, or architectural decisions.
