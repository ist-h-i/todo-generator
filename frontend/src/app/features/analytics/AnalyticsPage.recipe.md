# Recipe: AnalyticsPage

Source: `frontend/src/app/features/analytics/analytics.page.ts`

## Purpose & Responsibilities
- Render the analytics dashboard summary (progress, status and label breakdowns).
- Drive the immunity map workflow: load AI-generated A candidates, allow selection and edits, and request map generation.
- Surface readout cards and Mermaid output with copy support.

## Public API
- Signals: `summarySignal`, `statusBreakdown`, `labelBreakdown`, `pointSummary`, `candidatesResource`, `candidates`, `generatedMap`.
- Methods: `refreshCandidates`, `updateWindowDays`, `toggleCandidateSelection`, `updateCandidateText`, `generateImmunityMap`, `copyMermaid`, `toggleAdvancedMode`.

## Notable Dependencies
- `WorkspaceStore` for workspace metrics and card data.
- `ImmunityMapGateway` for candidate and map generation calls.
- `PageLayout` and `RouterLink` for layout and navigation.

## Usage Notes
- Candidate requests default to a 28-day window and include reports, cards, and profile data.
- Advanced mode enables manual A entries and optional context input; context policy is resolved automatically.
- Candidate selection is preserved across refreshes when possible; first candidate is auto-selected if none.

## Testing Notes
- No component unit tests yet; API wiring is covered in `frontend/src/app/core/api/immunity-map-gateway.spec.ts`.

## Change History
- 2025-12-30: Replaced manual A-only flow with AI candidate selection, advanced inputs, and readout card rendering.
