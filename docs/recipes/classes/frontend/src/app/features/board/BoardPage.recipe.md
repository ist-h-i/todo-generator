# Recipe: BoardPage

Source: `frontend/src/app/features/board/page.ts`

## Purpose & Responsibilities
Renders the board view of task cards with grouping, filtering, drag-and-drop, and subtask management.

## Public API
- Methods:
  - `isSubtaskResolved()` – Check if a subtask is in a resolved status.
  - `isCardResolved()` – Determine if all subtasks in a card are resolved.
  - `updateSearch()` – Apply a text search filter.
  - `clearFilters()` – Reset all filters to defaults.
  - `toggleQuickFilter()` – Toggle a quick filter flag.
  - `moveCard()` – Move a card to another column/status.
  - `handleDrop()` – Handle card DnD drop between columns.
  - `handleSubtaskDrop()` – Handle subtask DnD drop between status columns.
  - `saveCardDetails()` – Persist edited card details.
  - `updateSubtaskTitle()` – Update a subtask title.
  - `updateSubtaskAssignee()` – Update a subtask assignee.
  - `updateSubtaskEstimate()` – Update estimate hours for a subtask.
  - `updateSubtaskDueDate()` – Update due date for a subtask.
  - `changeSubtaskStatus()` – Change subtask status.
  - `deleteSubtask()` – Remove a subtask from a card.
  - `addSubtask()` – Create a new subtask for the selected card.
  - `isActiveCard()` – Check if a card is currently selected.
  - `statusColor()` – Get accent color for a status.
  - `columnAccent()` – Get accent color for a board column.
  - `statusName()` – Resolve a status name by id.
  - `subtaskStatusLabel()` – Resolve a subtask status label.
  - `subtaskStatusAccent()` – Resolve a subtask status accent color.
  - `priorityLabel()` – Resolve a priority label.
  - `dateInputValue()` – Normalize a date string for inputs.
  - `labelName()` – Resolve label name.
  - `isLabelApplied()` – Check if a label is applied to a card.
  - `handleLabelToggle()` – Toggle a label on a card.
- Properties:
  - `subtaskStatusOptions` – Static metadata for subtask statuses.
  - `groupingSignal`, `groupingLabelSignal`, `columnsSignal`, `filtersSignal` – Board state signals.
  - `filteredCardsSignal`, `statusesSignal`, `labelsSignal` – Derived data signals.
  - `quickFilters` – Available quick filter options.
  - `cardsByIdSignal`, `labelsByIdSignal`, `statusesByIdSignal` – Lookup maps as signals.
  - `searchForm`, `cardForm`, `newSubtaskForm` – Signal-driven forms.
  - `commentAuthorNameSignal`, `commentsByContextSignal`, `orphanedSubtaskCommentsSignal` – Comment view state.
  - `selectedCardSignal` – Active card signal.

## Notable Dependencies
- Injects `WorkspaceStore` for board state, mutations, and persistence.
- Uses `@angular/cdk/drag-drop` for drag-and-drop interactions.
- Relies on shared UI: `PageHeaderComponent` and `LocalDateTimePipe`.

## Usage Notes
- Board behavior is derived from signals; ensure UI updates read from the provided signals.
- Side-effecting updates are funneled through `WorkspaceStore` methods to keep logic centralized.
- Keep DnD handlers defensive (no-ops for invalid or same-container moves).

## Change History
- Seeded by generator. Append context on future changes.

