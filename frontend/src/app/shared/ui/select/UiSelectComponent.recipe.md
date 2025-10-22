# Recipe: UiSelectComponent

Source: `frontend/src/app/shared/ui/select/ui-select.ts`

## Purpose & Responsibilities
- Wrap Angular's `<select>` semantics in a modern, design-system aligned trigger and floating options panel for single-select scenar
  ios while delegating to the native control for multi/size variants.
- Expose a `ControlValueAccessor` so forms APIs can read/write the selected value through Angular signals or reactive forms.
- Keep projected `<option>` nodes as the single source of truth, reflecting changes into the custom panel and native element.

## Public API
- Inputs:
  - `id?: string`, `name?: string` – forward identifiers to the hidden/visible native control.
  - `multiple: boolean | null` – toggles multi-select; disables the custom panel when truthy.
  - `size?: number` – forces the native control when greater than `1` to preserve listbox behaviour.
  - `placeholder?: string` – fallback label shown when no option is selected.
- ControlValueAccessor hooks: `writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`.
- Template-bound handlers: `togglePanel`, `closePanel`, `onOptionClick`, `onSelectChange`, `onKeydown`, `onDocClick`.

## Notable Dependencies
- Angular `CommonModule` for structural directives used in the inline template (`*ngIf`, `*ngFor`, `ng-template`).
- `NG_VALUE_ACCESSOR` provider to register the component with Angular forms.
- `ElementRef` to access the underlying native `<select>` for syncing values and reading projected options.

## Usage Notes
- Use inside template-driven or reactive forms like any other `<select>`; projected `<option>`/`<optgroup>` nodes remain declarative
  ly authored in the consuming component.
- Single-select mode (`!multiple && (!size || size === 1)`) renders a custom trigger with keyboard (ArrowUp/Down, Enter, Escape) an
  d click handling, plus a floating panel constrained to the host width.
- Multi-select or list-style (`size > 1`) scenarios skip the custom UI and simply style the native control, avoiding unexpected be
  haviour changes.
- The component automatically reconciles projected options after content checks; call `detectChanges` from the parent if options a
  re mutated outside Angular's normal lifecycle.
- Dark mode and forced-colors considerations are handled internally (icon inherits `currentColor`; caret hidden under forced color
  s).

## Change History
- Generated scaffold replaced with detailed documentation (2025-10-22) to describe the custom select behaviour, inputs, and acces
  sibility affordances.

