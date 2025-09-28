# Mock Data Usage Investigation

This note captures the current areas where the product still relies on mock or deterministic fallback data instead of fully wired back-end integrations.

## Frontend findings

### Analyzer proposals
- `AnalysisGateway` does not call the FastAPI `/analysis` endpoint; instead it waits 420 ms and locally generates a proposal list by feeding the analyzer request and workspace settings into `AnalysisProposalFactory`.【F:frontend/src/app/core/api/analysis-gateway.ts†L1-L74】
- `AnalysisProposalFactory` synthesises two proposals per request using hard-coded label heuristics, deterministic confidence scores, and canned subtask templates. This keeps the UI responsive but means analyzer results are mock data.【F:frontend/src/app/core/api/analysis-proposal-factory.ts†L1-L200】

### Continuous improvement dashboard
- `ContinuousImprovementStore` seeds analytics snapshots, cause trees, and initiatives from the `CONTINUOUS_IMPROVEMENT_*` fixtures rather than fetching from `/analytics` APIs.【F:frontend/src/app/core/state/continuous-improvement-store.ts†L1-L149】
- The fixture module currently exports empty arrays, so any dashboard content must be populated manually when demoing.【F:frontend/src/app/core/state/continuous-improvement-fixtures.ts†L1-L7】

## Backend findings

### Recommendation scoring
- `RecommendationScoringService` explicitly states it mimics the production LLM scorer with deterministic token-similarity heuristics and returns a 0 score with a fallback message if those heuristics fail, so downstream consumers receive mock AI scores.【F:backend/app/services/recommendation_scoring.py†L29-L109】

### Analyzer fallbacks
- When Gemini returns no usable proposals, `GeminiClient.analyze` injects a `_fallback_card` derived from the submitted notes to ensure at least one mock card is produced.【F:backend/app/services/gemini.py†L140-L169】【F:backend/app/services/gemini.py†L430-L434】

### Appeal generation fallbacks
- `AppealGenerationService` instantiates `AppealFallbackBuilder` and records that deterministic content was used whenever Gemini or the prompt templates are unavailable, persisting the fallback output with a `generation_status` of `fallback`.【F:backend/app/services/appeals.py†L60-L155】
- `AppealFallbackBuilder` itself renders canned markdown, bullet list, or CSV narratives with fixed connective phrases so generated appeals remain consistent without LLM support.【F:backend/app/services/appeal_prompts.py†L140-L204】

## Follow-up considerations
- Replace the analyzer mock with a real HTTP call once a Gemini API key is configured, and gate the mock behind a feature flag for offline development.
- Backfill realistic analytics fixtures or connect `ContinuousImprovementStore` to the `/analytics` endpoints to align the UI with production data.
- Document the deterministic scoring and appeal fallbacks so operators know when mock content is persisted, and add monitoring for repeated fallback events.
