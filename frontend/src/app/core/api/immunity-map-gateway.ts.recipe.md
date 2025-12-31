# Recipe: frontend/src/app/core/api/immunity-map-gateway.ts

## Purpose & Entry Points
- Wrap immunity map APIs in a typed gateway and expose a Resource-based loader.
- Entry points: `ImmunityMapGateway.getCandidates`, `createCandidatesResource`, `generate`.

## Key Functions
- `getCandidates`: POST `/analysis/immunity-map/candidates` with candidate options.
- `createCandidatesResource`: `rxResource` wrapper that reacts to a request signal.
- `generate`: POST `/analysis/immunity-map` with selected A items and optional context.

## Important Variables
- (none)

## Interactions & Dependencies
- `HttpClient` for API calls and `buildApiUrl` for URL resolution.
- Used by `AnalyticsPage` to load candidates and generate immunity maps.

## Testing Notes
- `frontend/src/app/core/api/immunity-map-gateway.spec.ts` covers request wiring.

## Change History
- 2025-12-30: Added immunity map candidates and generation gateway methods.
