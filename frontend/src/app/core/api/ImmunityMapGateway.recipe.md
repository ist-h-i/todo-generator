# Recipe: ImmunityMapGateway

Source: `frontend/src/app/core/api/immunity-map-gateway.ts`

## Purpose & Responsibilities
- Provide typed API access for immunity map candidate generation and map creation.
- Offer a signal-driven Resource wrapper for candidate requests.

## Public API
- Methods: `getCandidates`, `createCandidatesResource`, `generate`.
- Properties: (none).

## Notable Dependencies
- `HttpClient` for POST requests.
- `buildApiUrl` for environment-aware API base URL.

## Usage Notes
- `createCandidatesResource` expects a signal that can be `null`; when null, the resource returns `null`.
- Callers should handle `ResourceRef` loading/error states before rendering candidates.

## Change History
- 2025-12-30: Added gateway for immunity map candidate and generation endpoints.
