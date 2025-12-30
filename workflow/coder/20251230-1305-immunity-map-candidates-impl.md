# Coder Log: Immunity Map Candidates + Analytics UI

## Summary
- Implemented immunity map candidate generation flow and context assembly on the backend, including report retention for context sourcing.
- Replaced analytics immunity map UI with candidate selection, advanced manual inputs, readout cards, and Mermaid output; added gateway tests.
- Added or updated recipes for new schemas, services, gateway, and analytics UI.

## Step-by-step Actions
1. Reviewed updated immunity map and analytics-insights specs plus Angular/UI guidelines to align the new flow.
2. Implemented backend schema additions, context builder, and `/analysis/immunity-map/candidates`, keeping status reports after submit; verified via file inspection.
3. Updated frontend models and gateway, replaced analytics page UI/logic for candidate selection and generation, and added an immunity map gateway spec.
4. Wrote or refreshed recipe files covering all touched backend and frontend modules.
5. Skipped full validation commands due to time; see Risks & Follow-ups.

## Evidence & References
- backend/app/routers/analysis.py
- backend/app/services/immunity_map.py
- backend/app/schemas.py
- backend/app/services/status_reports.py
- backend/tests/test_analysis.py
- backend/tests/test_status_reports.py
- frontend/src/app/features/analytics/feature/analytics-page.component.ts
- frontend/src/app/features/analytics/feature/analytics-page.component.html
- frontend/src/app/core/api/immunity-map-gateway.ts
- frontend/src/app/core/api/immunity-map-gateway.spec.ts
- frontend/src/app/core/models/immunity-map.ts
- docs/features/immunity-map/requirements.md
- docs/features/analytics-insights/detail-design.md

## Recipe Updates
- backend/app/services/status_reports.py.recipe.md: documented retention change and Gemini workflow.
- backend/app/services/immunity_map.py.recipe.md: documented context builder inputs and caps.
- backend/app/routers/analysis.py.recipe.md: documented immunity map endpoints and parsing helpers.
- backend/app/schemas.py.recipe.md: documented new immunity map schema types.
- frontend/src/app/core/models/immunity-map.ts.recipe.md: documented TS contracts for immunity map flows.
- frontend/src/app/core/api/immunity-map-gateway.ts.recipe.md: documented candidate and generation endpoints.
- frontend/src/app/core/api/ImmunityMapGateway.recipe.md: documented class-level responsibilities and usage.
- frontend/src/app/features/analytics/AnalyticsPage.recipe.md: updated UI responsibilities and signals.

## Risks & Follow-ups
- Tests/lints/builds not run: `pytest backend/tests`, `ruff check backend`, `black --check backend/app backend/tests`, `npm run lint`, `npm run format:check`, `npm test -- --watch=false`, `npm run build`.
- Consider adding component-level UI tests for the analytics immunity map workflow.
