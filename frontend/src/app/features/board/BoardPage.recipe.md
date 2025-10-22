# Recipe: BoardPageComponent

Source: `frontend/src/app/features/board/feature/board-page.component.ts`

## Purpose & Responsibilities
- Hosts the board feature page template and delegates all stateful logic to `BoardPageStore`.
- Provides the UI with bound signals/actions exposed by the store to keep the template lean.

## Public API
- Methods: (none detected)
- Properties: (none detected)

## Notable Dependencies
- `BoardPageStore` (feature facade/state)
- Angular CDK drag & drop directives via the template

## Usage Notes
- Injected store is provided at the component level so each board shell has an isolated state instance.
- Tests should mock or provide `BoardPageStore` rather than relying on `WorkspaceStore` directly.

## Change History
- 2025-10-22: Converted to thin shell delegating to `BoardPageStore` to satisfy the governance facade pattern.
