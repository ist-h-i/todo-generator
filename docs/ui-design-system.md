# UI Design System (Simple & Modern)

To deliver a minimal, modern, and polished tone across the app, the visual structure, typography, and component specifications follow the guidelines below. By balancing light and shadow, shared color tokens, and consistent interaction states, both light and dark themes maintain the same texture. Use this document as the reference whenever you redesign screens or ship new features.

## Core Design Principles
1. **Let whitespace breathe** – Keep information density low and rely on generous spacing plus a clear grid for layouts that feel calm.
2. **Be intentional with contrast** – Build on neutral base colors and reserve accent colors for the most important actions or states. Ensure 4.5:1 contrast between text and background (3:1 for large text) in both themes.
3. **Remove hesitation** – Align buttons and navigation with simple shapes and colors so users instantly see where they can take action.
4. **Stay accessible** – Treat sufficient contrast, clear focus states, and screen-reader-friendly structure as the default.

## Visual Foundation
### Color Palette
- **Token structure**: Name every color `--color-{semantic}-{state}-{theme}` to clarify the theme (`light` / `dark`) and interaction state (`default` / `hover` / `active` / `disabled`).
- **Base surfaces**: Use `--color-surface` and `--color-surface-alt`, expressing elevation with 1px borders or subtle tone shifts. The light theme centers on neutrals 50–200; the dark theme centers on neutrals 800–950 and relies on `color-mix` borders instead of heavy shadows.
- **Text**: Combine `--color-text-primary` and `--color-text-secondary`. Headings target 90% strength, supporting text about 60%. In the dark theme, change lightness instead of opacity and keep at least a 60-point Lab difference from the background.
- **Accent**: Use `--color-accent` for primary actions and `--color-success` / `--color-warning` / `--color-danger` for feedback states. To avoid overusing accents, differentiate page-specific colors by token tone rather than introducing new hues.
- **Surfaces**: Define `--surface-layer-{1-4}` tokens for layered surfaces. Apply them to cards, panels, and status pills. Each layer derives from `--surface-card` and `--surface-card-muted`, swapping values consistently between light and dark themes.
- **No drop shadows**: Remove decorative shadows from interactive elements and elevated surfaces. Express depth with tonal shifts and 1px borders (including inset lines) so both themes stay crisp and accessible.

### Theme & Contrast Guidance
| Element | Light Theme | Dark Theme | Notes |
| --- | --- | --- | --- |
| Page background | `--color-surface-light-default` #F8FAFC | `--color-surface-dark-default` #0F172A | Maintain ≥4.5:1 contrast with text. |
| Card background | `--color-surface-alt-light-default` #FFFFFF | `--color-surface-alt-dark-default` #1E293B | Highlight elevation with subtle borders and tone shifts. |
| Primary text | `--color-text-primary-light` #0F172A | `--color-text-primary-dark` #F8FAFC | Even uppercase headings must meet 3:1. |
| Secondary text | `--color-text-secondary-light` rgba(15,23,42,0.65) | `--color-text-secondary-dark` rgba(248,250,252,0.70) | Measure contrast rather than relying on opacity. |

> **Check rule**: For every major component state (default/hover/active/focus/disabled), keep background-to-text and background-to-border contrast at 3:1 or higher (aim for 4.5:1). In the dark theme, emphasize lightness differences and verify that accent colors meet WCAG AA.

### Surface Layers & Borders
| Token | Light Theme | Dark Theme | Primary Usage |
| --- | --- | --- | --- |
| `--surface-layer-1` | Top of the gradient. Blend `--surface-card` to 96%. | Blend `--surface-card` to 94%. | Base cards, form fields, user badges |
| `--surface-layer-2` | Blend `--surface-card` to 88%. | Blend `--surface-card` to 86%. | Section/panel lower tones, card bottoms |
| `--surface-layer-3` | Blend `--surface-card` to 78%. | Blend `--surface-card` to 76%. | Pills, toggles, hover surfaces |
| `--surface-layer-4` | Blend `--surface-card` to 68%. | Blend `--surface-card` to 66%. | Neutral overlays, areas that need emphasis |

Use `--border-card` / `--border-card-strong` as the default borders and reserve `--border-subtle` for elements that sit on similar backgrounds. Wrap page wrappers or sub-containers with soft 1px lines such as `1px solid color-mix(in srgb, var(--color-surface-inverse) 14%, transparent)` and set their background about 4% darker than cards to show hierarchy. Outline cards and modules with a 1px `var(--color-border-strong)` line and add a 1px inset line for clarity. When states change (hover/focus), shift the border color by 8–10% and adjust the background tone so cards feel elevated without shadows. Keep column depth consistent by pairing layer tokens (e.g., `layer-1` → `layer-2`).

### Interaction State Matrix
| Component | State | Light Theme | Dark Theme | Contrast Guidance |
| --- | --- | --- | --- | --- |
| Primary button | Default / Hover / Active | #2563EB / #1D4ED8 / #1E40AF | #3B82F6 / #2563EB / #1D4ED8 | Text stays #FFFFFF (≥7:1). |
| Secondary button | Default / Hover / Active | #FFFFFF with #CBD5F5 border / background +4% tone / background +8% tone | #1E293B with #3B4B65 border / background −6% / background −10% | Text uses #1E293B or #F8FAFC with ≥4.5:1 contrast. |
| Ghost button | Default / Hover / Active | Text #1E293B / background rgba(30,41,59,0.06) / rgba(30,41,59,0.10) | Text #E2E8F0 / background rgba(226,232,240,0.12) / rgba(226,232,240,0.18) | Maintain ≥3:1 against the page background. |
| Card | Default / Hover | #FFFFFF / #F1F5F9 | #1E293B / #243044 | Keep content text ≥4.5:1. |
| Status pill | Default / Hover | Background #E0F2FE–#FEE2E2 / text #0369A1 etc. | Background #0F2F49–#3F1D2B / text #E0F2FE etc. | Ensure ≥4.5:1 text contrast. |
| Disabled elements | All states | Background differs by ≥12 lightness points; text #94A3B8 (light) / #475569 (dark) for ≥3:1 | – |

### Typography
- Base fonts: `Inter` with `Noto Sans JP`; body size 16px (rem-based).
- Heading scale: `--font-size-heading-lg` (page title), `--font-size-heading-md` (section), `--font-size-heading-sm` (cards/lists).
- Line height: 1.6 for body text, 1.3 for headings. Keep ≥1em spacing between paragraphs.
- KPI values on dashboards use `.metric-card__value` with `font-size: clamp(1.5rem, 1.2rem + 1vw, 2.25rem)` and `font-weight: 600`, preserving readability on both desktop and mobile.

### Spacing & Corner Radius
- Follow an 8px spacing grid. Within cards and panels use 24px padding; keep 16px between components and about 32px between sections.
- Default corner radius: `--radius-md` (8px); cards and modals use `--radius-lg` (16px).
- Avoid shadows for elevation. Instead, use 1px borders and background contrast: parent containers get semi-transparent borders (~12%), and child cards use solid borders to separate layers.

### Iconography & Focus
- Use 1.5px stroke line icons at 20px or 24px sizes.
- Standardize focus rings with `outline: 2px solid var(--color-accent); outline-offset: 2px;` across all interactive elements.

## Layout Templates
### Application Shell
- Every page uses `.app-page` as the root container with padding `clamp(40px, 8vw, 72px)` on all sides.
- Structure each shell with a fixed header (logo + primary navigation), content wrapper, and footer. Sidebars live inside the content wrapper as a two-column layout.

### Page Header
- Reuse the `app-page-header` component everywhere. It contains four areas:
  - **Eyebrow** – Category or breadcrumb in small sans-serif text.
  - **Title** – Page-specific heading, 28px/700 by default.
  - **Description** – One or two lines of supporting text at 60% tone.
  - **Actions** – Primary/secondary buttons on the right; tabs or filters align along the bottom when present.
- Keep the background flat (same as the page surface) without borders.

### Grid & Containers
- Use `.page-section` to divide content into a header (title, description, actions) and body. Leave 32px between sections.
- When multiple columns are needed, use `.page-grid`, switching from two columns to one at the 1024px breakpoint.
- Implement sidebars or filter panels with `.page-grid--sidebar` so cards and margins stay aligned.

## Component Specifications
### Buttons
- Base class `.button` has 44px height, auto width, 15px/600 typography, and `0 20px` padding. Ensure ≥4.5:1 text contrast.
- Variants:
  - `.button--primary`: Background `--color-accent-{state}`, text `--color-text-on-accent-{state}`. Darken by 8% on hover and 12% on active, keeping ≥4.8:1 in light theme and ≥7:1 in dark theme.
  - `.button--secondary`: Background `--color-surface-alt`, border `--color-border`. Intensify border/text by 10% on hover and add a 6% tone to the background on active. Disabled state drops the border to 30% strength while maintaining 3:1 contrast.
  - `.button--ghost`: Transparent background with primary text. Apply `rgba(surface, 0.08)` on hover and `rgba(surface, 0.12)` on active; always keep ≥3:1 contrast.
  - `.button--pill`: Fully rounded (999px). Use for filters or tag chips; selected state adopts the accent background, deselected state follows the ghost pattern.
- Maintain an 8px gap for icon+text buttons and use 20px icons.
- For focus, keep the background and add a 2px accent outline.
- Do not reduce text opacity for loading or disabled states; adjust background tone instead to maintain 3:1 contrast.

### Cards
- Base cards use `.surface-card` with `linear-gradient(180deg, var(--surface-layer-1), var(--surface-layer-2))`, a `1px solid var(--color-border-strong)` outline, and an inset `color-mix(in srgb, var(--color-surface-alt) 70%, transparent)` line. Padding 24px, radius 12px.
- Recommended structure: header (title + metadata), body, footer (actions). Header uses flex alignment with 18px/600 titles.
- Place a `surface-pill` status badge at the top-right; background uses a 12% accent tone.
- On hover, shift the background tone by ±6% (lighter in light theme, darker in dark) without changing text color, keeping ≥4.5:1 contrast. Avoid reintroducing drop shadows—use the tone shift and border emphasis instead.

### Card Containers
- Use `.card-collection` for grids: `display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;`.
- For kanban layouts, use `.board-columns`. Column headers mirror card styling, and columns apply `linear-gradient(180deg, var(--surface-layer-2), var(--surface-layer-3))`. Lay a surface 4% darker (light theme) or lighter (dark theme) than cards underneath, with a 1px inset border to emphasize hierarchy. Keep 24px gaps between columns.

### Lists & Tables
- `.page-list` presents stacked cards with `grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr))`, scaling up to three columns and collapsing to one responsively. Each item has 16px vertical padding and dividing borders.
- Tables use `.page-table` with header backgrounds `--color-surface-alt` and 16px cell padding. Avoid heavy rules or diagonals; use striping for clarity.

### Forms
- Structure inputs with `.form-field` (label, description, input). Labels use 14px/600, descriptions 12px at 60% tone.
- Inputs are 44px tall with 8px radius and `1px solid var(--color-border)` borders. Focus states switch the border to the accent color.
- Use `.form-grid` for multi-column layouts; default columns use `minmax(240px, 1fr)`.
- Display validation messages directly under inputs with red-toned text and `role="alert"`.
- Disabled fields base on `var(--surface-layer-3)` plus 8% accent tint while keeping secondary text color for ≥3:1 contrast.

### Status Chips & Badges
- `.surface-pill` uses 999px rounding with `8px 12px` padding and 13px/600 text.
- Provide `--pill-success`, `--pill-warning`, and `--pill-danger`; backgrounds use ~16% tone while text stays dark for contrast.
- Use `.page-badge` for auxiliary labels inside cards with 6px radius and flat backgrounds.

### Tabs & Toggles
- `.page-tabs` align tabs horizontally. Active tabs show an accent underline and full-strength text; inactive tabs use 60% tone.
- `.form-toggle` keeps toggles minimal: accent color only when checked, border-only when unchecked.
- Define color sets per state in both themes so background and label combinations always reach ≥3:1 contrast. Increase underline thickness to 2px on hover and add an 8% background tone on active.

### Feedback & Empty States
- Use `app-alert` for success/warning/error messages with four parts: icon, title, description, and action.
- Empty and loading states use `.page-state` with monochrome line icons around 64px.

### Dialogs / Modals
- Base on `.app-dialog` with max-width 480px and 16px radius. Separate header (title + close), body (text or form), and footer (actions).
- Overlays cover the viewport with 40% black and disable background scrolling.

## Operational Rules
1. Prioritize these components for new UI; coordinate with design before introducing custom styles.
2. Keep Figma or other design files in sync with this guide and update both when discrepancies appear.
3. Maintain the same structure in the dark theme by swapping tokens only. When adding tokens, capture contrast ratios for both themes and every state to ensure WCAG AA compliance.
4. Append change history to `docs/ui-design-system.md` and share component updates with the development team.
