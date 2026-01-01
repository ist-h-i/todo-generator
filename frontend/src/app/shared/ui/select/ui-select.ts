import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
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
  templateUrl: './ui-select.html',
  styleUrl: './ui-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSelect implements ControlValueAccessor, AfterContentInit, OnDestroy {
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  public readonly id = input<string | undefined>();
  public readonly name = input<string | undefined>();
  public readonly multiple = input<boolean | null>(null);
  public readonly size = input<number | undefined>();
  public readonly placeholder = input<string | undefined>();
  public readonly disabled = input<boolean | null | undefined>(undefined);
  public readonly options = input<
    ReadonlyArray<{ value: string | number; label: string; disabled?: boolean }> | null | undefined
  >(null);
  public readonly value = input<string | string[] | null | undefined>(undefined);
  public readonly valueChange = output<string | string[] | null>();

  private readonly disabledState = signal(false);
  public readonly isDisabled = computed(() => {
    const fromInput = this.disabled();
    return fromInput === null || fromInput === undefined ? this.disabledState() : fromInput;
  });
  public readonly selection = signal<string | string[] | null>(null);
  public readonly panelOpen = signal(false);
  public readonly selectedLabel = signal('');
  public readonly activeIndex = signal(-1);
  public readonly panelId = `ui-select-panel-${Math.random().toString(36).slice(2, 9)}`;

  public readonly isSingleMode = computed(
    () => !this.multiple() && (!this.size() || this.size() === 1),
  );

  readonly nativeSelectRef = viewChild<ElementRef<HTMLSelectElement>>('nativeSelect');
  readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');

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

  private normalizeSelection(
    value: string | string[] | null | undefined,
  ): string | string[] | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry));
    }
    return String(value);
  }

  private selectionsEqual(
    left: string | string[] | null,
    right: string | string[] | null,
  ): boolean {
    if (left === right) {
      return true;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        return false;
      }
      return left.every((value, index) => value === right[index]);
    }
    return false;
  }

  private updateSelection(
    next: string | string[] | null | undefined,
    options: { emit: boolean },
  ): void {
    const normalized = this.normalizeSelection(next);
    if (this.selectionsEqual(normalized, this.selection())) {
      return;
    }

    this.selection.set(normalized);
    this.syncNativeSelectFromValue();
    this.scheduleNativeSelectSync();
    this.syncLabelFromValue();
    if (this.panelOpen()) {
      this.ensureActiveIndex();
    }

    if (options.emit) {
      this.onChange(normalized);
      this.valueChange.emit(normalized);
    }
  }

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

  private readonly syncValueInputEffect = effect(() => {
    const incoming = this.value();
    if (incoming === undefined) {
      return;
    }
    this.updateSelection(incoming, { emit: false });
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
    this.updateSelection(obj as string | string[] | null | undefined, { emit: false });
  }
  registerOnChange(fn: (val: string | string[] | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
  }

  onSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (this.multiple()) {
      const vals = Array.from(target.selectedOptions).map((o) => o.value);
      this.updateSelection(vals, { emit: true });
    } else {
      const val = target.value;
      this.updateSelection(val, { emit: true });
    }
  }

  togglePanel(event?: MouseEvent): void {
    if (this.isDisabled() || !this.isSingleMode()) {
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
        const el = this.triggerRef()?.nativeElement;
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
    this.updateSelection(opt.value, { emit: true });
    this.closePanel(true);
  }

  public setActiveIndex(index: number): void {
    this.activeIndex.set(index);
  }

  isSelected(val: string): boolean {
    // Normalize current value to a string array for a unified check
    const current = this.selection();
    const selected: string[] = Array.isArray(current)
      ? current
      : current != null
        ? [String(current)]
        : [];
    return selected.includes(val);
  }

  private syncNativeSelectFromValue(): void {
    const sel = this.nativeSelectRef()?.nativeElement;
    if (!sel) {
      return;
    }
    if (this.multiple()) {
      const current = this.selection();
      const selected = Array.isArray(current) ? current.map(String) : [];
      Array.from(sel.options).forEach((o) => (o.selected = selected.includes(o.value)));
      return;
    }
    const current = this.selection();
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
    const sel = this.nativeSelectRef()?.nativeElement;
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
    const current = this.selection();
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
    const sel = this.nativeSelectRef()?.nativeElement;
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

    const sel = this.nativeSelectRef()?.nativeElement;
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
    if (this.isDisabled() || !this.isSingleMode()) {
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
