# Verbalize Yourself Frontend

Angular 20 single-page application that follows the product specification in the repository root README. It provides the Gemini-assisted capture flow, kanban board, analytics, and workspace configuration screens required for the Verbalize Yourself experience.

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

| Command               | Description                                        |
|-----------------------|----------------------------------------------------|
| `npm start`           | Start the dev server with HMR                      |
| `npm run build`       | Produce a production build in `dist/`              |
| `npm test`            | Execute Karma unit tests using ChromeHeadlessNoSandbox |
| `npm run lint`        | Check TypeScript sources with ESLint               |
| `npm run format:check` | Verify that Prettier formatting matches the rules |
| `npm run format:write` | Apply Prettier formatting updates in place        |

> **Note:** Both `npm test` and `npm run test:ci` run with the `ChromeHeadlessNoSandbox` launcher so the same configuration works locally and in CI pipelines.

## Project Structure Highlights

- `src/app/core` — Domain models, authenticated API clients, and singleton state stores.
- `src/app/features/*/feature` — Smart routed components that coordinate each feature flow.
- `src/app/features/shell` — Navigation chrome, hover message infrastructure, and profile dialog.
- `src/app/features/*/ui` — Presentational building blocks scoped to their feature.
- `src/app/features/*/data-access` — Feature-scoped services and facades that call backend APIs.
- `src/app/lib/forms` — Signal-powered form utilities shared across features.
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
