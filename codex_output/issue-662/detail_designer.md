**Scope & Target**

- Component: `frontend/src/app/shared/ui/select/ui-select.ts`
- Mode: Single-select only (custom trigger + panel). Multi/size variants use native `<select>` (unchanged).

**Current Behavior**

- Panel toggles via trigger click; renders options from `@Input() options` or projected `<option>`.
- Clicking an option invokes `onOptionClick` then closes the panel:
  - Option click binding: `frontend/src/app/shared/ui/select/ui-select.ts:98`
  - Handler: `frontend/src/app/shared/ui/select/ui-select.ts:348`
  - Close routine with focus restore: `frontend/src/app/shared/ui/select/ui-select.ts:330`
- Keyboard parity:
  - Enter selects active option and closes: `frontend/src/app/shared/ui/select/ui-select.ts:547`
  - Escape closes: `frontend/src/app/shared/ui/select/ui-select.ts:554`
- Outside click closes without forcing focus: `frontend/src/app/shared/ui/select/ui-select.ts:522`
- Trigger blur only marks touched (does not close): `frontend/src/app/shared/ui/select/ui-select.ts:45`

**Design Change**

- Required behavior “close on option click” is already satisfied via `(click)` → `onOptionClick` → `closePanel(true)`.
- No structural changes needed; retain existing focus management and ARIA roles (listbox/option).
- Guardrail (only if real-world blur ordering issues arise): switch option handler to `mousedown` for early capture to ensure selection then close. Not recommended proactively to minimize change.

**Data Flow**

- Inputs: `id`, `name`, `multiple`, `size`, `placeholder`, `options`.
- Internal state: `value`, `panelOpen`, `selectedLabel`, `activeIndex`, `displayOptions`.
- CVA contract: `writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`.
- Selection path (single-select): option click/Enter → update `value` → `onChange(value)` → sync native `<select>` → update `selectedLabel` → `closePanel(true)`.

**Contracts & Integration**

- ControlValueAccessor semantics unchanged; external forms and pages (`admin`, `reports`) continue to bind normally.
- Rendering paths:
  - Single-select custom panel: `frontend/src/app/shared/ui/select/ui-select.ts:34`
  - Native select path (multi/size): `frontend/src/app/shared/ui/select/ui-select.ts:111`
- No new inputs/outputs; no API surface change.

**Accessibility & Keyboard**

- Roles: `role="listbox"` panel, `role="option"` items with `aria-selected` (maintain).
- Focus: `closePanel(true)` returns focus to trigger for option-click/Enter/Escape; outside click uses `closePanel(false)` to avoid focus hijack.
- Arrow navigation sets `activeIndex`; Enter selects; Escape closes.

**Acceptance Mapping**

- Click selects and closes: handled by `onOptionClick` + `(click)` (lines 98, 348–356).
- Keyboard Enter/Space parity: Enter closes via `onOptionClick` (line 547–552). Space currently not selecting; add only if required.
- Multi-select behavior unchanged (native control path).

**Residual Risks & Open Questions**

- Space key: Should Space also select/close like Enter for parity? If yes, extend key handler.
- If any variant introduces a search input inside the panel later, verify that closing on option click doesn’t disrupt input interactions.
- If future refactor ports the panel to a portal/overlay, re-check outside-click containment logic (`root.contains(target)`).
- Confirm there is no multi-select requirement to close on selection (currently intentionally not closing).

**Test Notes (manual)**

- Open panel, click an option → value updates, panel closes, focus returns to trigger.
- Open panel, ArrowDown + Enter → selection and close.
- Escape closes, outside click closes without focus jump.
- Multi-select/native `<select>` unaffected.