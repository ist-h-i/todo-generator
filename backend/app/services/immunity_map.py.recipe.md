# Recipe: backend/app/services/immunity_map.py

## Purpose & Entry Points
- Build prompt-ready context and summaries for immunity map candidate generation and map generation.
- Entry point: `build_immunity_map_context` with window, include flags, and optional target.

## Key Functions
- `build_immunity_map_context`: composes profile, status report excerpts, card metrics, and optional snapshot/target into JSON prompt and summary text.
- `_collect_status_report_entries`: reads recent reports and extracts short excerpts via `StatusReportContentService`.
- `_collect_card_context`: loads recent cards, builds metrics, and serializes notable cards.
- `_resolve_snapshot_context` / `_resolve_target_context`: include analytics snapshot or target card when allowed.
- `_truncate` and `_to_iso`: normalize prompt fields and timestamps.

## Important Variables
- `DEFAULT_IMMUNITY_MAP_WINDOW_DAYS`: default lookback window (28 days).
- `_MAX_STATUS_REPORTS`, `_MAX_CARD_EXCERPTS`, `_MAX_SECTION_CHARS`, `_MAX_CARD_CHARS`, `_MAX_SNAPSHOT_CHARS`, `_MAX_METRIC_KEYS`: caps to keep prompts small.

## Interactions & Dependencies
- SQLAlchemy models: `StatusReport`, `Card`, `Status`, `AnalyticsSnapshot`.
- `StatusReportContentService` for report section extraction.
- Used by `backend/app/routers/analysis.py` for immunity map candidate and generation flows.

## Testing Notes
- `backend/tests/test_analysis.py` exercises candidate generation flow using this context builder.
- Add targeted service tests if prompt assembly or truncation rules change.

## Change History
- 2025-12-30: Added immunity map context builder for candidate and generation prompts.
