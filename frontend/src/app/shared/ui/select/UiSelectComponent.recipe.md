# Recipe: UiSelectComponent

Source: `frontend/src/app/shared/ui/select/ui-select.ts`

## Purpose & Responsibilities
Briefly describe what this class/component does and when it is used.

## Public API
- Methods: (none detected)
- Properties: (none detected)

## Notable Dependencies
List injected services, inputs/outputs, and important collaborators.

## Usage Notes
- Accepts projected `<option>` elements or an `[options]` input with value/label pairs for rendering.
- Acts as a `ControlValueAccessor` and keeps the native `<select>` element in sync for forms integration.
- In single-select mode, clicking an option (or pressing <kbd>Enter</kbd>) selects it, closes the custom panel immediately, and returns focus to the trigger button. Outside clicks and <kbd>Escape</kbd> also close the panel without forcing focus.

## Change History
- Seeded by generator. Append context on future changes.
- 2025-10-22: Added support for binding options via the `[options]` input and ensured native select synchronisation.
- 2025-10-24: Confirmed single-select option interactions close the panel on activation and documented the behaviour.

