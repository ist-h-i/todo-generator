# Recipe: UiSelectComponent

Source: `frontend/src/app/shared/ui/select/ui-select.ts`

## Purpose & Responsibilities
- Renders the design-system single- and multi-select input, exposing both a custom single-select experience and a native `<select>` fallback for multi/size variants.
- Bridges Angular forms by implementing `ControlValueAccessor`, keeping the hidden native element in sync with the projected options.

## Public API
- Inputs: `id`, `name`, `placeholder`, `multiple`, `size`, `options`, `disabled`.
- Methods: `writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`, `togglePanel`, `openPanel`, `closePanel`.
- Template references: `trigger`, `nativeSelect`.

## Notable Dependencies
- Angular `ControlValueAccessor` contract via `NG_VALUE_ACCESSOR` for forms integration.
- Relies on projected `<option>` elements or `[options]` input for option definitions.

## Usage Notes
- Accepts projected `<option>` elements or an `[options]` input with value/label pairs for rendering.
- Acts as a `ControlValueAccessor` and keeps the hidden native `<select>` element aligned with the reactive form control value.
- Single-select mode exposes a custom trigger and option panel; clicking an option (or pressing Enter) updates the value, closes the panel immediately, and returns focus to the trigger for accessibility parity.
- Escape key or outside clicks close the panel without changing the selection; multi-select/native variants remain open until the user blurs the control.

## Change History
- Seeded by generator. Append context on future changes.
- 2025-10-22: Added support for binding options via the `[options]` input and ensured native select synchronisation.
- 2025-10-23: Confirmed single-select option activation closes the panel immediately and recorded focus-management behaviour.

