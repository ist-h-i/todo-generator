# Todo Generator Frontend

Angular 20 single-page application that follows the product specification in the repository root README. It provides the Gemini-assisted capture flow, kanban board, analytics, and workspace configuration screens required for the Todo Generator experience.

## Key Features

- **Input Analyzer** – Paste free-form notes and review Gemini proposals before publishing tasks to the board.
- **Workspace Board** – Accessible CDK drag-and-drop columns grouped by status, label, or assignee with card detail drawers.
- **Card Detail Management** – Update metadata, progress subtasks, and log comments/activity from a focused drawer UI.
- **Analytics Dashboard** – Summaries for completion rate, story points, and distribution across statuses and labels.
- **Workspace Settings** – Maintain custom labels, statuses, and default AI prompt guidance.
- **Design System** – Minimal, responsive layout powered by CSS design tokens, dark mode, and WCAG-aware interactions.

## Getting Started

```bash
npm install
npm start
```

The application is served at `http://localhost:4200/` with hot reload enabled.

### Essential Scripts

| Command           | Description                                   |
|-------------------|-----------------------------------------------|
| `npm start`       | Start the dev server with HMR                 |
| `npm run build`   | Produce a production build in `dist/`         |
| `npm test`        | Execute Karma unit tests (no suites defined)  |

## Project Structure Highlights

- `src/app/core` – Domain models, state, API clients, and the application shell.
- `src/app/core/layout` – Navigation shell and history sidebar primitives.
- `src/app/features/analyze` – AI input analyzer components.
- `src/app/features/board` – Board UI, card previews, and detail drawer.
- `src/app/features/analytics` – Progress and distribution insights.
- `src/app/features/settings` – Workspace configuration forms.
- `src/app/lib/forms` – Signal-powered form utilities shared across features.

## Design Tokens & Accessibility

Global styles in `src/styles.scss` expose variables for color, spacing, typography, and dark-mode variants. Layout landmarks (`banner`, `main`, `complementary`, `contentinfo`) aid navigation, focus rings remain visible, and dynamic regions use polite announcements.

## Coding Guidelines

Angular 20 code in this repository follows the standards below. Reference them when creating new
components, utilities, and tests.

1. **Project Structure** – Split features into standalone modules and prefer lazy loading. Organize
   folders by `feature`, `shared`, and `core` domains.
2. **Component Design** – Ensure single responsibility, default to `standalone: true`, use signals
   for binding and forms via `signalForms`, and enable `ChangeDetectionStrategy.OnPush`.
3. **Data Fetching** – Rely on the Resource API (`RxResource`) for remote data, handling lifecycle
   and errors centrally. Wrap `HttpClient` calls with `Resource.from` rather than direct usage in
   services.
4. **State Management** – Prefer Signal Store for global state. Keep local UI state as component
   signals, leverage `computed`/`effect`, and reserve NgRx only for existing large apps.
5. **TypeScript Safety** – Compile with `"strict": true`, avoid `any`, define DTO types for API
   responses, and express resource states via union types
   (`'idle' | 'loading' | 'success' | 'error'`).
6. **Function Rules** – Default to arrow functions with explicit parameter and return types (include
   `void`). Nest helper functions when they serve a single caller and mark class members with access
   modifiers.
7. **Comments** – Use JSDoc for classes and public members. Document parameters, return values, and
   rationale; avoid repeating obvious implementation details.
8. **Naming** – Follow `camelCase` for variables/functions, `PascalCase` for types and classes,
   `UPPER_SNAKE_CASE` for constants, suffix signals with `Signal`, and forms with `Form`. Name files
   using kebab-case.
9. **Class Design** – Apply single responsibility, use constructor injection for dependencies, and
   declare access modifiers on members.
10. **File Rules** – Keep one class/service/component per file with kebab-case filenames and limit
    files to 400 lines.
11. **Readability** – Enforce 2-space indents, limit lines to 100 characters, insert blank lines
    after imports, between methods, and before `return` statements.
12. **Styling** – Base UI on Tailwind CSS utilities, collect shared styles in `style.scss`, combine
    utilities with SCSS mixins for composite patterns, and support dark mode via CSS variables.
13. **RxJS & Async** – Avoid manual `subscribe`. Coordinate async workflows with `RxResource`,
    integrate signals, and call `takeUntilDestroyed` for teardown logic.
14. **Error Handling** – Surface errors through Resource states or explicit `try/catch`, log via
    `LoggerService`, and propagate user-visible issues to the UI.
15. **Extensibility** – Replace magic numbers with constants, prefer union types over enums, and
    simplify branching with early returns.
16. **Imports** – Order imports as Angular → third-party → application, remove unused entries, and
    prefer absolute aliases (`@app/...`).
17. **Testing** – Use Jest or Jasmine/Karma for unit tests and Playwright for E2E. Name specs with
    `should + 動詞 + 条件` and maintain ≥80% coverage with mocks for HttpClient, Resource, and Signal
    Store.
18. **Accessibility** – Apply appropriate ARIA attributes, pair inputs with labels, and meet WCAG
    2.1 AA contrast ratios.
19. **Security** – Sanitize `[innerHTML]` via `DomSanitizer`, centralize auth/logging in
    `HttpInterceptor`, and enforce CSRF protections.
20. **Performance** – Embrace lazy loading, rely on Signals plus `RxResource` to reduce change
    detection, and verify builds with `ng build --configuration production`.
21. **Documentation** – Maintain Storybook entries, capture architecture decisions with ADRs, and
    provide type-focused JSDoc.
22. **Git & Review** – Use Conventional Commits (e.g., `feat: add user login form`) and keep PRs
    under 200 lines with clear descriptions.
23. **CI/CD** – Integrate lint/format/test into CI, require production builds per PR, and validate
    performance and accessibility through Lighthouse before deployment.
