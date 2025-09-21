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
