# Recipe: backend/app/routers/analysis.py

## Purpose & Entry Points
- Expose analysis and immunity map endpoints under `/analysis`.
- Entry points: `POST /analysis`, `POST /analysis/immunity-map/candidates`, `POST /analysis/immunity-map`.

## Key Functions
- `analyze`: runs Gemini analysis for free-form notes and persists proposals.
- `generate_immunity_map_candidates`: builds context and returns candidate A items.
- `generate_immunity_map`: builds A nodes, applies context policy, generates B-F nodes, and renders Mermaid.
- `_parse_immunity_map_candidates`, `_parse_readout_cards`: sanitize Gemini output into schema-safe objects.
- `_render_immunity_map_mermaid`: renders flowchart TD with subgraphs and escaped labels.
- `_resolve_context_policy`: reconciles manual context with policy flags.

## Important Variables
- `_IMMUNITY_MAP_SYSTEM_PROMPT` and `_IMMUNITY_MAP_CANDIDATE_SYSTEM_PROMPT`: system instructions for Gemini.
- `_IMMUNITY_MAP_RESPONSE_SCHEMA` and `_IMMUNITY_MAP_CANDIDATE_RESPONSE_SCHEMA`: structured output schemas.
- `_MAX_LABEL_LENGTH`, `_ALLOWED_READOUT_KINDS`, `_ALLOWED_EVIDENCE_TYPES`: validation guards.

## Interactions & Dependencies
- `GeminiClient` for structured generation and error mapping.
- `build_immunity_map_context` for auto context from reports, cards, profile, snapshots.
- `build_user_profile` for analysis endpoint context.

## Testing Notes
- `backend/tests/test_analysis.py` covers candidate endpoint behavior and readout card parsing.
- Add tests when schema or mermaid rendering rules change.

## Change History
- 2025-12-30: Added immunity map candidates endpoint, context policy handling, and readout card parsing.
