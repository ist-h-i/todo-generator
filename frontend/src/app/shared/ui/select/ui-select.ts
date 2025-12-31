import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type UiSelectOption = { value: string; label: string; disabled: boolean };

@Component({
  selector: 'shared-ui-select',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSelect),
      multi: true,
    },
  ],
  host: {
    '(document:click)': 'onDocClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <div class="ui-select" [class.ui-select--disabled]="disabled()">
      <!-- Single-select: custom trigger + panel -->
      @if (isSingleMode()) {
        <button
          #trigger
          type="button"
          class="form-control app-select ui-select__trigger"
          [id]="id() || null"
          [attr.aria-haspopup]="'listbox'"
          [attr.aria-expanded]="panelOpen()"
          [attr.aria-controls]="panelId"
          [disabled]="disabled()"
          (click)="togglePanel($event)"
          (blur)="onTouched()"
        >
          <span class="ui-select__value">{{ selectedLabel() || placeholder() || '' }}</span>
          <span class="ui-select__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>

        <!-- Native select kept for projected <option>; visually hidden in single mode -->
        <select
          #nativeSelect
          class="ui-select__native ui-select__native--hidden"
          tabindex="-1"
          aria-hidden="true"
          inert
          [name]="name() || null"
          [disabled]="disabled()"
          [multiple]="multiple() || null"
          [attr.size]="size() ?? null"
          [value]="!multiple() ? (value() ?? '') : null"
          (change)="onSelectChange($event)"
        >
          @if (providedOptions()?.length) {
            @for (opt of providedOptions(); track opt.value) {
              <option [value]="opt.value" [disabled]="opt.disabled ? true : null">
                {{ opt.label }}
              </option>
            }
          } @else {
            <ng-content></ng-content>
          }
        </select>

        @if (panelOpen()) {
          <div class="ui-select__panel" role="listbox" [id]="panelId">
            @for (opt of displayOptions(); track opt.value; let i = $index) {
              <div
                class="ui-select__option"
                [class.is-selected]="isSelected(opt.value)"
                [class.is-disabled]="opt.disabled"
                [class.is-active]="i === activeIndex()"
                role="option"
                [attr.aria-selected]="isSelected(opt.value)"
                (click)="onOptionClick(opt, $event)"
                (mouseenter)="setActiveIndex(i)"
              >
                @if (isSelected(opt.value)) {
                  <span class="ui-select__check" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                }
                <span class="ui-select__label">{{ opt.label }}</span>
              </div>
            }
          </div>
        }
      } @else {
        <select
          #nativeSelect
          class="form-control app-select"
          [id]="id() || null"
          [name]="name() || null"
          [disabled]="disabled()"
          [multiple]="multiple() || null"
          [attr.size]="size() ?? null"
          [value]="!multiple() ? (value() ?? '') : null"
          (change)="onSelectChange($event)"
          (blur)="onTouched()"
        >
          @if (providedOptions()?.length) {
            @for (opt of providedOptions(); track opt.value) {
              <option [value]="opt.value" [disabled]="opt.disabled ? true : null">
                {{ opt.label }}
              </option>
            }
          } @else {
            <ng-content></ng-content>
          }
        </select>
      }
    </div>
  `,
  styles: [
    `
      .ui-select {
        position: relative;
        display: block;
      }
      .ui-select--disabled {
        opacity: 0.7;
        pointer-events: none;
      }

      .ui-select__trigger {
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding-right: 2.5rem;
        background-image: none !important;
      }
      .ui-select__value {
        flex: 1 1 auto;
        min-width: 0;
        text-align: left;
      }
      /* Match icon color to current text color (fixes dark-mode blending) */
      .ui-select__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: currentColor;
      }

      /* Hidden variant used only for single-select custom panel mode */
      .ui-select__native--hidden {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        appearance: none;
      }

      .ui-select__panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 1000;
        min-width: 100%;
        max-height: min(24rem, 60vh);
        overflow: auto;
        padding: 0.25rem;
        border-radius: 0.75rem;
        border: 1px solid var(--border-subtle);
        background: var(--surface-card);
        color: var(--text-primary);
        box-shadow:
          0 12px 28px -16px color-mix(in srgb, var(--surface-inverse) 50%, transparent),
          0 2px 10px -6px color-mix(in srgb, var(--surface-inverse) 35%, transparent);
        transform-origin: top center;
        animation: uiSelectIn 140ms ease-out;
      }

      @keyframes uiSelectIn {
        from {
          opacity: 0;
          transform: scale(0.98);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .ui-select__option {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.625rem 0.5rem 2rem;
        border-radius: 0.5rem;
        cursor: pointer;
        color: var(--text-primary);
        transition:
          background-color 140ms ease,
          color 140ms ease;
      }
      .ui-select__option:hover {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      .ui-select__option.is-selected {
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: var(--text-primary);
      }
      .ui-select__option.is-active {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .ui-select__option:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
        outline-offset: 2px;
      }
      .ui-select__option.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .ui-select__check {
        position: absolute;
        left: 0.5rem;
        display: inline-flex;
        width: 1rem;
        height: 1rem;
        align-items: center;
        justify-content: center;
        color: var(--accent);
      }
      .ui-select__label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dark .ui-select__panel {
        background: color-mix(in srgb, var(--surface-layer-3) 96%, transparent);
        border-color: color-mix(in srgb, var(--border-overlay) 78%, transparent);
      }
      /* Ensure trigger text and icon share a high-contrast color in dark mode */
      .dark .ui-select__trigger {
        color: var(--text-primary);
      }
      .dark .ui-select__option:hover {
        background: color-mix(in srgb, var(--accent) 16%, transparent);
      }
      .dark .ui-select__option.is-selected {
        background: color-mix(in srgb, var(--accent) 22%, transparent);
      }
      .dark .ui-select__option.is-active {
        background: color-mix(in srgb, var(--accent) 18%, transparent);
      }

      @media (forced-colors: active) {
        .ui-select__icon {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSelect implements ControlValueAccessor, AfterContentInit, OnDestroy {
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  public readonly id = input<string | undefined>();
  public readonly name = input<string | undefined>();
  public readonly multiple = input<boolean | null>(null);
  public readonly size = input<number | undefined>();
  public readonly placeholder = input<string | undefined>();
  public readonly options = input<
    ReadonlyArray<{ value: string | number; label: string; disabled?: boolean }> | null | undefined
  >(null);

  public readonly disabled = signal(false);
  public readonly value = signal<string | string[] | null>(null);
  public readonly panelOpen = signal(false);
  public readonly selectedLabel = signal('');
  public readonly activeIndex = signal(-1);
  public readonly panelId = `ui-select-panel-${Math.random().toString(36).slice(2, 9)}`;

  public readonly isSingleMode = computed(
    () => !this.multiple() && (!this.size() || this.size() === 1),
  );

  @ViewChild('nativeSelect', { static: true }) nativeSelectRef!: ElementRef<HTMLSelectElement>;
  @ViewChild('trigger', { static: false }) triggerRef?: ElementRef<HTMLButtonElement>;

  public readonly displayOptions = signal<UiSelectOption[]>([]);
  public readonly providedOptions = signal<UiSelectOption[] | null>(null);
  private optionsSignature = '';
  private scheduledReconcile = false;
  private pendingForceReconcile = false;
  private destroyed = false;
  private optionsObserver?: MutationObserver;
  private pendingNativeSync = false;
  private suppressNextToggle = false;
  private suppressNextToggleResetScheduled = false;
  private removeDocumentPointerDownListener: (() => void) | null = null;

  private onChange: (val: string | string[] | null) => void = () => {};
  // Must be public to be callable from the template (blur) handler
  public onTouched: () => void = () => {};

  private readonly documentPointerDownCaptureHandler = (event: PointerEvent): void => {
    if (!this.panelOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    const root = this.hostRef.nativeElement;
    if (root.contains(target)) {
      return;
    }

    // Close early (capture phase) so outside interactions reliably dismiss the panel even if a
    // parent element stops bubbling, or a wrapping <label> triggers a synthetic click.
    this.armSuppressNextToggle();
    this.closePanel(false);
  };

  private scheduleSuppressNextToggleReset(): void {
    if (this.suppressNextToggleResetScheduled) {
      return;
    }

    this.suppressNextToggleResetScheduled = true;
    setTimeout(() => {
      this.suppressNextToggle = false;
      this.suppressNextToggleResetScheduled = false;
    }, 250);
  }

  private armSuppressNextToggle(): void {
    this.suppressNextToggle = true;
    this.scheduleSuppressNextToggleReset();
  }

  private applyProvidedOptions(): void {
    const options = this.providedOptions();
    if (!options) {
      return;
    }
    this.displayOptions.set([...options]);
    this.optionsSignature = this.displayOptions()
      .map((option) => `${option.value}::${option.label}::${option.disabled ? '1' : '0'}`)
      .join('|');
    this.syncNativeSelectFromValue();
    this.scheduleNativeSelectSync();
    this.syncLabelFromValue();
    if (this.panelOpen()) {
      this.ensureActiveIndex();
    }
  }

  private readonly syncOptionsEffect = effect(() => {
    const options = this.options();
    if (!options || options.length === 0) {
      this.providedOptions.set(null);
      this.scheduleProjectedOptionsReconciliation(true);
      return;
    }

    this.providedOptions.set(
      options.map((option) => ({
        value: String(option.value),
        label: option.label,
        disabled: !!option.disabled,
      })),
    );
    this.applyProvidedOptions();
  });

  ngAfterContentInit(): void {
    if (!this.providedOptions()) {
      this.scheduleProjectedOptionsReconciliation(true);
    } else {
      this.applyProvidedOptions();
    }
    this.observeProjectedOptions();
    this.installDocumentPointerDownListener();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.optionsObserver?.disconnect();
    this.removeDocumentPointerDownListener?.();
  }

  writeValue(obj: unknown): void {
    this.value.set(obj as string | string[] | null);
    this.syncNativeSelectFromValue();
    this.scheduleNativeSelectSync();
    this.syncLabelFromValue();
  }
  registerOnChange(fn: (val: string | string[] | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (this.multiple()) {
      const vals = Array.from(target.selectedOptions).map((o) => o.value);
      this.value.set(vals);
      this.onChange(vals);
    } else {
      const val = target.value;
      this.value.set(val);
      this.onChange(val);
    }
    this.syncLabelFromValue();
  }

  togglePanel(event?: MouseEvent): void {
    if (this.disabled() || !this.isSingleMode()) {
      return;
    }
    // When <shared-ui-select> is nested inside a <label>, clicks on the label (or its children)
    // can trigger a follow-up synthetic click on the trigger button. If the panel was just
    // closed due to an outside click / selection, ignore that follow-up toggle.
    if (this.suppressNextToggle) {
      this.suppressNextToggle = false;
      event?.preventDefault();
      return;
    }
    this.panelOpen.set(!this.panelOpen());
    if (this.panelOpen()) {
      this.ensureActiveIndex();
    }
  }

  closePanel(restoreFocus = false): void {
    if (!this.panelOpen()) {
      return;
    }
    this.panelOpen.set(false);
    // Optionally restore focus to the trigger for a11y.
    // Avoid forcing focus on outside clicks by passing restoreFocus = false in those cases.
    if (restoreFocus && this.isSingleMode()) {
      Promise.resolve().then(() => {
        // Guard against teardown during async microtask
        const el = this.triggerRef?.nativeElement;
        el?.focus?.();
      });
    }
  }

  onOptionClick(opt: { value: string; label: string; disabled: boolean }, event?: Event): void {
    if (opt.disabled) return;
    // Prevent <label> activation from re-triggering the button click after selecting an option.
    event?.preventDefault();
    event?.stopPropagation();
    this.armSuppressNextToggle();
    this.value.set(opt.value);
    this.onChange(opt.value);
    this.selectedLabel.set(opt.label);
    this.syncNativeSelectFromValue();
    this.scheduleNativeSelectSync();
    this.closePanel(true);
  }

  public setActiveIndex(index: number): void {
    this.activeIndex.set(index);
  }

  isSelected(val: string): boolean {
    // Normalize current value to a string array for a unified check
    const current = this.value();
    const selected: string[] = Array.isArray(current)
      ? current
      : current != null
        ? [String(current)]
        : [];
    return selected.includes(val);
  }

  private syncNativeSelectFromValue(): void {
    const sel = this.nativeSelectRef?.nativeElement;
    if (!sel) {
      return;
    }
    if (this.multiple()) {
      const current = this.value();
      const selected = Array.isArray(current) ? current.map(String) : [];
      Array.from(sel.options).forEach((o) => (o.selected = selected.includes(o.value)));
      return;
    }
    const current = this.value();
    sel.value = current != null ? String(current) : '';
  }

  private scheduleNativeSelectSync(): void {
    if (this.pendingNativeSync) {
      return;
    }
    this.pendingNativeSync = true;
    Promise.resolve().then(() => {
      this.pendingNativeSync = false;
      this.syncNativeSelectFromValue();
    });
  }

  private readOptions(): void {
    const sel = this.nativeSelectRef?.nativeElement;
    if (!sel) return;
    const opts = Array.from(sel.options || []);
    this.displayOptions.set(
      opts.map((o) => ({
        value: o.value,
        label: this.resolveOptionLabel(o),
        disabled: o.disabled,
      })),
    );
  }

  private syncLabelFromValue(): void {
    // Normalize current value to a string array to avoid null/primitive pitfalls
    const current = this.value();
    const selected: string[] = Array.isArray(current)
      ? current
      : current != null
        ? [String(current)]
        : [];

    if (this.multiple()) {
      // For multiple, show joined labels or empty
      if (selected.length) {
        const labels = this.displayOptions()
          .filter((o) => selected.includes(o.value))
          .map((o) => o.label);
        this.selectedLabel.set(labels.join(', '));
      } else {
        this.selectedLabel.set('');
      }
      return;
    }
    const found = this.displayOptions().find((o) => String(o.value) === String(current ?? ''));
    this.selectedLabel.set(found?.label ?? '');
  }

  private ensureActiveIndex(): void {
    const idx = this.displayOptions().findIndex((o) => this.isSelected(o.value));
    this.activeIndex.set(idx >= 0 ? idx : 0);
  }

  private scheduleProjectedOptionsReconciliation(force = false): void {
    if (force) {
      this.pendingForceReconcile = true;
    }
    if (this.scheduledReconcile) {
      return;
    }
    this.scheduledReconcile = true;
    Promise.resolve().then(() => {
      this.scheduledReconcile = false;
      if (this.destroyed) {
        this.pendingForceReconcile = false;
        return;
      }
      const runForce = this.pendingForceReconcile;
      this.pendingForceReconcile = false;
      this.reconcileProjectedOptions(runForce);
    });
  }

  private observeProjectedOptions(): void {
    const sel = this.nativeSelectRef?.nativeElement;
    if (!sel || typeof MutationObserver === 'undefined') {
      return;
    }

    if (this.optionsObserver) {
      this.optionsObserver.disconnect();
    }

    this.optionsObserver = new MutationObserver(() => {
      this.scheduleProjectedOptionsReconciliation();
    });

    this.optionsObserver.observe(sel, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  private reconcileProjectedOptions(force = false): void {
    const provided = this.providedOptions();
    if (provided) {
      this.displayOptions.set([...provided]);
      this.optionsSignature = this.displayOptions()
        .map((option) => `${option.value}::${option.label}::${option.disabled ? '1' : '0'}`)
        .join('|');
      this.syncLabelFromValue();
      if (this.panelOpen()) {
        this.ensureActiveIndex();
      }
      return;
    }

    const sel = this.nativeSelectRef?.nativeElement;
    if (!sel) {
      return;
    }

    const nativeOptions = Array.from(sel.options || []);
    const nextSignature = nativeOptions
      .map((option) => {
        const label = this.resolveOptionLabel(option);
        return `${option.value}::${label}::${option.disabled ? '1' : '0'}`;
      })
      .join('|');

    if (!force && nextSignature === this.optionsSignature) {
      return;
    }

    this.optionsSignature = nextSignature;
    this.readOptions();
    this.syncLabelFromValue();
    if (this.panelOpen()) {
      this.ensureActiveIndex();
    }
  }

  private resolveOptionLabel(option: HTMLOptionElement): string {
    const label = option.label?.trim();
    if (label) {
      return label;
    }

    const text = option.textContent ?? '';
    return text.trim();
  }

  onDocClick(ev: MouseEvent): void {
    if (!this.panelOpen()) {
      return;
    }
    const target = ev.target as Node | null;
    const root = this.hostRef.nativeElement;
    if (target && !root.contains(target)) {
      // See togglePanel(): outside clicks on a wrapping <label> can re-trigger a synthetic
      // click on the trigger button. Arm suppression before closing so the panel stays closed.
      this.armSuppressNextToggle();
      this.closePanel(false);
    }
  }

  private installDocumentPointerDownListener(): void {
    if (this.removeDocumentPointerDownListener || typeof document === 'undefined') {
      return;
    }

    document.addEventListener('pointerdown', this.documentPointerDownCaptureHandler, true);
    this.removeDocumentPointerDownListener = () => {
      document.removeEventListener('pointerdown', this.documentPointerDownCaptureHandler, true);
    };
  }

  onKeydown(ev: KeyboardEvent): void {
    if (this.disabled() || !this.isSingleMode()) {
      return;
    }
    const options = this.displayOptions();
    const max = options.length - 1;
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        if (!this.panelOpen()) {
          this.panelOpen.set(true);
          this.ensureActiveIndex();
          return;
        }
        this.activeIndex.set(Math.min(max, this.activeIndex() < 0 ? 0 : this.activeIndex() + 1));
        break;
      case 'ArrowUp':
        ev.preventDefault();
        if (!this.panelOpen()) {
          this.panelOpen.set(true);
          this.ensureActiveIndex();
          return;
        }
        this.activeIndex.set(Math.max(0, this.activeIndex() < 0 ? 0 : this.activeIndex() - 1));
        break;
      case 'Enter':
        if (this.panelOpen() && this.activeIndex() >= 0) {
          ev.preventDefault();
          const opt = options[this.activeIndex()];
          if (opt && !opt.disabled) {
            this.onOptionClick(opt);
          }
        }
        break;
      case 'Escape':
        if (this.panelOpen()) {
          ev.preventDefault();
          this.closePanel(true);
        }
        break;
      default:
        break;
    }
  }
}
