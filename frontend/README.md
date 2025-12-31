# Verbalize Yourself Frontend

Angular 20 single-page application that follows the product specification in the repository root README. It provides the Gemini-assisted capture flow, kanban board, analytics, and workspace configuration screens required for the Verbalize Yourself experience.

## Key Features

- **Input Analyzer**  EPaste free-form notes and review Gemini proposals before publishing tasks to the board.
- **Workspace Board**  EAccessible CDK drag-and-drop columns grouped by status, label, or assignee with card detail drawers.
- **Card Detail Management**  EUpdate metadata, progress subtasks, and log comments/activity from a focused drawer UI.
- **Analytics Dashboard**  ESummaries for completion rate, story points, and distribution across statuses and labels.
- **Workspace Settings**  EMaintain custom labels, statuses, and default AI prompt guidance.
- **Design System**  EMinimal, responsive layout powered by CSS design tokens, dark mode, and WCAG-aware interactions.

## Getting Started

```bash
npm install
npm start
```

The application is served at `http://localhost:4200/` with hot reload enabled.

### Essential Scripts

| Command               | Description                                        |
|-----------------------|----------------------------------------------------|
| `npm start`           | Start the dev server with HMR                      |
| `npm run build`       | Produce a production build in `dist/`              |
| `npm test`            | Execute Karma unit tests using ChromeHeadlessNoSandbox |
| `npm run lint`        | Check TypeScript sources with ESLint               |
| `npm run format:check` | Verify that Prettier formatting matches the rules |
| `npm run format:write` | Apply Prettier formatting updates in place        |
| `npm run test:e2e`     | Run Playwright end-to-end tests (starts `ng serve`) |
| `npm run test:e2e:install` | Download the Chromium browser for Playwright |

> **Note:** Both `npm test` and `npm run test:ci` run with the `ChromeHeadlessNoSandbox` launcher so the same configuration works locally and in CI pipelines.

### End-to-End Tests (Playwright)

```bash
npm run test:e2e:install
npm run test:e2e
```

`npm run test:e2e:install` downloads the Chromium browser used by the test runner. Playwright boots the Angular dev server at `http://localhost:4200` (see `playwright.config.ts`). If your scenario needs the API, start the backend on `http://localhost:8000` before running the tests.

## Project Structure Highlights

- `src/app/core`  Domain models, authenticated API clients, and singleton state stores.
- `src/app/features/*/*.routes.ts`  Feature route definitions loaded from `app.routes.ts`.
- `src/app/features/shell`  Navigation chrome, hover message infrastructure, and profile dialog.
- `src/app/features/*/ui`  Presentational building blocks scoped to their feature.
- `src/app/features/*/data`  Feature-scoped services and gateways that call backend APIs.
- `src/app/shared`  Reusable UI primitives, pipes, and utilities shared across features.

## Design Tokens & Accessibility

Global styles in `src/styles.scss` expose variables for color, spacing, typography, and dark-mode variants. Layout landmarks (`banner`, `main`, `complementary`, `contentinfo`) aid navigation, focus rings remain visible, and dynamic regions use polite announcements.

## Repository guidelines

- [Development Governance Handbook](../docs/governance/development-governance-handbook.md)
- [Angular Coding & Design Guidelines](../docs/guidelines/angular-coding-guidelines.md)
- [UI Design System](../docs/ui-design-system.md)
- [UI Layout Requirements](../docs/ui-layout-requirements.md)

How to use these guides:
- Start with the Development Governance Handbook for repository structure, backend practices, quality gates, and AI-driven expectations.
- Apply the Angular Coding & Design Guidelines whenever you touch the SPA.
- Keep design and workflow docs in sync when updating components, flows, or build tooling. Document intentional deviations.
