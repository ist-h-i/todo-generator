# Recipe: backend/app/schemas.py

## Purpose & Entry Points
- Central Pydantic schema definitions for API requests and responses.
- Entry points: imported by routers and services to validate payloads.

## Key Classes
- `ImmunityMapEvidenceType`, `ImmunityMapContextPolicy`, `ImmunityMapReadoutKind`: enums for immunity map semantics.
- `ImmunityMapEvidence`, `ImmunityMapReadoutCard`, `ImmunityMapCandidate`, `ImmunityMapCandidateRequest/Response`.
- `ImmunityMapRequest` and `ImmunityMapResponse` with context policy, targets, and readout cards.

## Important Variables
- `ImmunityMapCandidateRequest.window_days` default 28 and `max_candidates` default 10.
- `ImmunityMapRequest` validator enforces non-empty `a_items`.

## Interactions & Dependencies
- `backend/app/routers/analysis.py` uses these schemas for immunity map endpoints.
- Frontend mirrors these contracts in `frontend/src/app/core/models/immunity-map.ts`.

## Testing Notes
- `backend/tests/test_analysis.py` covers schema-driven responses for immunity map endpoints.

## Change History
- 2025-12-30: Added immunity map candidate, evidence, readout, and context policy schemas.
