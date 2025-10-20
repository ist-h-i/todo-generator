# Screen Layout Requirements

## Document Control

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Author | Product Design Team |
| Last Updated | 2024-07-05 |
| Status | Draft |

## 1. Purpose & Background

A recent audit uncovered inconsistent spacing across key screens: some areas feel overcrowded while others have excessive padding. To improve scanability and ergonomics, this specification standardises layout structure and spacing so every page delivers a consistent rhythm.

## 2. Guiding Principles

1. **Consistent rhythm** – Use an 8px grid and scale margins in multiples (8 / 16 / 24 / 32 / 40 / 56 / 72) to create a predictable cadence.
2. **Priority-led density** – Match information density to content importance. Low-priority sections get more breathing room. Define baseline density for cards, forms, and tables.
3. **Aligned interactions** – Align filter bars, search inputs, and buttons to a common grid line. Keep vertical alignment and heights consistent.
4. **Responsive continuity** – Preserve the same hierarchy on desktop, tablet, and mobile by defining column widths and stacking order at each breakpoint.

## 3. Spacing & Sizing Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `space-xxs` | 4px | Micro adjustments between icon/label pairs |
| `space-xs` | 8px | Label ↔ form field, inline element spacing |
| `space-sm` | 12px | Subheading spacing, badge clusters |
| `space-md` | 16px | Default component gap, list item padding |
| `space-lg` | 24px | Card interior padding, section header ↔ body |
| `space-xl` | 32px | Between sections, page wrapper top/bottom |
| `space-2xl` | 40px | Below page headers, before major transitions |
| `space-3xl` | 56px | Page footer offset, hero sections |
| `space-4xl` | 72px | Maximum outer shell margin |

- Use `clamp(40px, 8vw, 72px)` for page gutters (mobile max 24px).
- Section headers must have at least `space-lg`; add `space-md` when supporting copy is present.
- Avoid stacking elements closer than 8px vertically.

## 4. Breakpoints & Grid System

| Breakpoint | Width | Columns | Gutter | Margin |
| --- | --- | --- | --- | --- |
| Mobile | 0–599px | 4 | 16px | 24px |
| Tablet | 600–1023px | 8 | 20px | 32px |
| Desktop | 1024–1439px | 12 | 24px | 40px |
| Large Desktop | 1440px+ | 12 | 32px | 72px |

- Base layouts on a 12-column grid; default card width is `minmax(320px, 4col)`.
- Two-column layouts with sidebars use an `8col : 4col` split on desktop and stack vertically on tablet and below.
- The global header remains 64px high, separated by a 1px border (no drop shadows).

## 5. Page Archetypes

### 5.1 Dashboard / Analytics Page

- **Structure**: page header, KPI card grid, two-column section (cause tree & suggested actions), report draft section.
- **Spacing**: `space-2xl` below the header, `space-xl` between grid rows.
- **Card grid**: `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))` with `space-lg` gaps.
- **Cause tree & actions**: `7col : 5col` split on desktop; stack with `space-xl` on tablet/mobile.

### 5.2 Board Page

- **Structure**: page header, filter bar, kanban board.
- **Filter bar**: `space-md` top/bottom, `space-md` between controls, trailing actions right-aligned while preserving alignment on wrap.
- **Board columns**: `space-lg` column gap, `space-md` between column header and cards, `space-md` between cards.
- **Scroll**: board region height is `calc(100vh - header - filter)` with padding adjustments to avoid extra whitespace.

### 5.3 Reports Page

- **Structure**: page header, input form, preview card.
- **Form grid**: two columns (`minmax(280px, 1fr)`) on desktop, single column on tablet/mobile, `space-lg` between fields.
- **Preview**: reserve `space-2xl` above the preview and separate it with a contrasting surface and border.

### 5.4 Settings / Administration Page

- **Structure**: left navigation sidebar and right content column.
- **Sidebar**: 280px width, `space-xl` vertical padding, `space-md` between items.
- **Content**: `space-xl` between sections, `space-lg` inside cards, align action buttons to the right edge.

### 5.5 Modal / Drawer

- Modal max width 480px with `space-lg` padding. Place `space-md` between title/body and `space-lg` before actions.
- Drawer width 400px. It touches the viewport edge; rely on internal padding for spacing.

## 6. Component-level Layout Rules

- **Page header**: eyebrow ↔ title uses `space-xs`; title ↔ description uses `space-sm`; action group sits `space-md` away.
- **Page section wrapper**: `.app-page-layout__section` uses CSS Grid to manage spacing; prefer grid `gap` tokens instead of stacking manual margins.
- **Card**: `space-lg` padding on all sides; `space-md` between header/body and paragraphs.
- **List item**: minimum height 56px, `space-md` vertical padding, `space-sm` between icon and text.
- **Table**: row height 48px, `space-md` horizontal cell padding, `space-xs` borders between rows.
- **Form field**: `space-xs` between label and control, `space-lg` between fields, helper text sits `space-xxs` below the label.

## 7. Responsive Behaviour

- Collapse header descriptions on mobile; move secondary actions into an overflow menu.
- Card grids render 1 column on mobile, 2 on tablet, 3+ on desktop.
- Sidebars become drawers on mobile, while main content keeps 24px side padding.

## 8. Accessibility & Readability

- Use spacing to reinforce logical grouping; never leave less than `space-md` between related blocks.
- Provide `space-sm` between button groups to support keyboard focus outlines.
- Keep spacing consistent so visual structure matches landmark regions for assistive tech.

## 9. Validation Checklist

1. Are outer gutters within the breakpoint-specific limits?
2. Are section gaps at least `space-xl`?
3. Do filter bars and forms maintain horizontal and vertical alignment?
4. Are any components closer than 8px vertically?
5. Do tablet/mobile stacks follow the same logical order and spacing?
6. Do dense areas (tables, grids) still honour `space-md` breathing room?
7. Does the implementation align with `docs/ui-design-system.md` tokens (`--space-*`, `--surface-layer-*`)?

## 10. Governance

- Layout changes require approval from the design system governance review.
- Update Figma layout grids with the latest tokens before implementation and review collaboratively.
- Reference both `docs/ui-design-system.md` and this specification; document any intentional deviations with rationale and impact.
