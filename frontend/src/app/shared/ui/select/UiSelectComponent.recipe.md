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
- In single-select mode, clicking an option immediately selects the value, closes the panel, and restores focus to the trigger button for accessibility parity.

## Change History
- Seeded by generator. Append context on future changes.
- 2025-10-22: Added support for binding options via the `[options]` input and ensured native select synchronisation.
- 2025-02-14: Documented the single-select click-to-close behaviour and corrected the source path reference.

