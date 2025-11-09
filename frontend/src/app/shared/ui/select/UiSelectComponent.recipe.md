# Recipe: UiSelectComponent

Source: `frontend/src/app/shared/ui/select/ui-select.ts`

## Purpose & Responsibilities
- Provide a custom single-select experience with an accessible trigger + panel while
  maintaining a hidden native `<select>` for forms integration.
- Fall back to rendering the native `<select>` directly for multi-select or `size > 1`
  scenarios.

## Public API
- Inputs:
  - `id`, `name`: pass-through attributes for the backing control.
  - `multiple`, `size`: toggle native select behaviour; when in multi/size mode the
    custom panel is disabled.
  - `placeholder`: text shown when no value is selected.
  - `options`: optional array of `{ value, label, disabled }` objects rendered in place
    of projected `<option>` elements.
- ControlValueAccessor hooks: `writeValue`, `registerOnChange`, `registerOnTouched`,
  `setDisabledState`.
- User interactions:
  - `togglePanel()` opens/closes the custom panel for single-select mode.
  - `onOptionClick()` selects an option, syncs the native control, closes the panel, and
    restores focus to the trigger.
  - Keyboard handler supports Arrow navigation, Enter to select/close, and Escape to
    close while returning focus.

## Notable Dependencies
- Angular `CommonModule` for structural directives.
- `ControlValueAccessor` from `@angular/forms` to integrate with Angular forms.
- `MutationObserver` is used (when available) to keep projected `<option>` content in
  sync with the custom panel.

## Usage Notes
- Accepts projected `<option>` elements or an `[options]` input with value/label pairs for rendering.
- Acts as a `ControlValueAccessor` and keeps the native `<select>` element in sync for forms integration.
- In single-select mode, clicking or pressing Enter on an option immediately closes the
  panel and returns focus to the trigger button for accessibility.
- Outside clicks and Escape also close the panel without forcing focus, matching native
  select behaviour.

## Change History
- Seeded by generator. Append context on future changes.
- 2025-10-22: Added support for binding options via the `[options]` input and ensured native select synchronisation.
- 2025-10-23: Documented confirmed single-select close-on-selection behaviour and public
  API surface; corrected source path reference.

