# Recipe: backend/app/services/status_reports.py

## Purpose & Entry Points
- Orchestrate status report CRUD and analysis workflows.
- Entry points: `StatusReportService` methods invoked by `backend/app/routers/status_reports.py`.

## Key Functions
- `create_report`: validate sections, persist drafts, and record creation events.
- `update_report`: normalize edits, save changes, and record update events.
- `submit_report`: call Gemini, store proposals/metadata, and return `StatusReportProcessResult` without deleting the report.
- `to_read`/`to_list_item`/`to_detail`: serialize reports via `StatusReportPresenter`.

## Important Variables
- `_MAX_GENERATED_CARDS`: default limit for proposals per analysis submission.
- `StatusReportProcessResult.destroyed`: remains `False` to keep reports for later context use.

## Interactions & Dependencies
- `GeminiClient` + `build_workspace_analysis_options` for analysis prompts and models.
- `StatusReportContentService` for section normalization and prompt composition.
- `StatusReportPresenter` for response shapes.
- SQLAlchemy models: `StatusReport`, `StatusReportEvent`, `StatusReportCardLink`.

## Testing Notes
- `backend/tests/test_status_reports.py` verifies reports are retained after submit.
- `backend/tests/test_analysis.py` relies on preserved reports for immunity map context.

## Change History
- 2025-12-30: Keep completed reports instead of deleting them after submit to support immunity map context.
