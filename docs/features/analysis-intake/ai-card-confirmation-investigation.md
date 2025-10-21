# AI Card Confirmation Screen Investigation

## Current Review Experience

- The analyze page renders each eligible proposal inside a read-only list that shows the generated title, summary, recommended status/labels, and subtask strings. Users can only publish an item or publish all proposals without editing any of the fields in place.【F:frontend/src/app/features/analyze/page.html†L221-L274】
- Subtasks are displayed as plain list entries that mirror the raw string values returned by the analysis gateway; there is no affordance for adding, removing, or editing subtask content from this screen.【F:frontend/src/app/features/analyze/page.html†L248-L254】

## Publish Flow

- Clicking "この案をカードに追加" or "すべての案をボードに追加" calls the `publishProposals` handler, which immediately forwards the immutable proposals to the workspace store without presenting an intermediate edit form.【F:frontend/src/app/features/analyze/page.html†L256-L272】【F:frontend/src/app/features/analyze/page.ts†L235-L260】
- `WorkspaceStore.importProposals` filters out ineligible entries and transforms each accepted proposal into a card create request. All proposal fields (title, summary, suggested status/labels, confidence, subtasks) are treated as final at this stage.【F:frontend/src/app/core/state/workspace-store.ts†L1194-L1258】
- Subtasks are converted from simple strings into `CardSuggestionPayload` objects with generated IDs and a fixed `'todo'` status, leaving no opportunity to adjust titles or remove individual subtasks before persistence.【F:frontend/src/app/core/state/workspace-store.ts†L1232-L1247】
- The card create request builder copies the provided values directly into the POST payload sent to the backend. Any edits would need to happen prior to this translation step.【F:frontend/src/app/core/state/workspace-store.ts†L1703-L1768】

## Data Model Considerations

- `AnalysisProposal` currently models subtasks as an immutable `readonly string[]`, so introducing per-subtask editing will require a richer client-side structure (e.g., IDs and mutable metadata) or a translation layer that can capture user overrides separately.【F:frontend/src/app/core/models/analysis.ts†L13-L22】
- Because proposals are forwarded untouched to `WorkspaceStore`, the confirmation experience is the only practical interception point to let users add, remove, or rewrite card details before the card creation API is invoked.

## Gaps & Next Steps

1. Add an editable proposal review surface that maps each AI field to form controls (title, summary, status, labels, confidence, subtasks) before calling `importProposals`.
2. Extend the proposal representation (or wrap it) so edited subtasks can persist titles, statuses, and any optional metadata required by `CardSuggestionPayload`.
3. Rework the publish handler to consume the edited payload instead of the original immutable proposal objects.
