# Recipe: frontend/src/app/core/models/immunity-map.ts

## Purpose & Entry Points
- Define TypeScript contracts for immunity map candidate generation and map responses.
- Entry points: imported by gateways and analytics UI components.

## Key Types
- `ImmunityMapCandidateRequest/Response`, `ImmunityMapCandidateInclude`, `ImmunityMapCandidate`, `ImmunityMapEvidence`.
- `ImmunityMapRequest`, `ImmunityMapResponse`, `ImmunityMapReadoutCard`, `ImmunityMapPayload`.
- `ImmunityMapContextPolicy`, `ImmunityMapReadoutKind`, `ImmunityMapEvidenceType` enums.

## Interactions & Dependencies
- Used by `frontend/src/app/core/api/immunity-map-gateway.ts` for API typing.
- Consumed by `AnalyticsPage` for candidate selection and map rendering.

## Testing Notes
- `frontend/src/app/core/api/immunity-map-gateway.spec.ts` exercises request/response typing.

## Change History
- 2025-12-30: Added candidate, evidence, readout, context policy, and target types for immunity map flows.
