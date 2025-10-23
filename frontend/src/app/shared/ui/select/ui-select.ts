import { CommonModule } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  forwardRef,
  Input,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

type UiSelectOption = { value: string; label: string; disabled: boolean };

@Component({
  selector: 'app-ui-select',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ui-select" [class.ui-select--disabled]="disabled">
      <!-- Single-select: custom trigger + panel -->
      <ng-container *ngIf="!multiple && (!size || size === 1); else nativeOnly">
        <button
          type="button"
          class="form-control app-select ui-select__trigger"
          [id]="id || null"
          [attr.aria-haspopup]="'listbox'"
          [attr.aria-expanded]="panelOpen"
          [attr.aria-controls]="panelId"
          [disabled]="disabled"
          (click)="togglePanel()"
          (blur)="onTouched()"
        >
          <span class="ui-select__value">{{ selectedLabel || placeholder || '' }}</span>
          <span class="ui-select__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          [name]="name || null"
          [disabled]="disabled"
          [multiple]="multiple || null"
          [attr.size]="size ?? null"
          [value]="!multiple ? (value ?? '') : null"
          (change)="onSelectChange($event)"
        >
          <ng-container *ngIf="providedOptions?.length; else projectedSingleOptions">
            <option
              *ngFor="let opt of providedOptions"
              [value]="opt.value"
              [disabled]="opt.disabled ? true : null"
            >
              {{ opt.label }}
            </option>
          </ng-container>
        </select>

        <ng-template #projectedSingleOptions>
          <ng-content></ng-content>
        </ng-template>

        <div
          *ngIf="panelOpen"
          class="ui-select__panel"
          role="listbox"
          [id]="panelId"
        >
          <div
            *ngFor="let opt of displayOptions; let i = index"
            class="ui-select__option"
            [class.is-selected]="isSelected(opt.value)"
            [class.is-disabled]="opt.disabled"
            [class.is-active]="i === activeIndex"
            role="option"
            [attr.aria-selected]="isSelected(opt.value)"
            (click)="onOptionClick(opt)"
            (mouseenter)="activeIndex = i"
          >
            <span class="ui-select__check" *ngIf="isSelected(opt.value)" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span class="ui-select__label">{{ opt.label }}</span>
          </div>
        </div>
      </ng-container>

      <!-- Multi/size variant: keep native select visible and styled globally -->
      <ng-template #nativeOnly>
        <select
          #nativeSelect
          class="form-control app-select"
          [id]="id || null"
          [name]="name || null"
          [disabled]="disabled"
          [multiple]="multiple || null"
          [attr.size]="size ?? null"
          [value]="!multiple ? (value ?? '') : null"
          (change)="onSelectChange($event)"
          (blur)="onTouched()"
        >
          <ng-container *ngIf="providedOptions?.length; else projectedNativeOptions">
            <option
              *ngFor="let opt of providedOptions"
              [value]="opt.value"
              [disabled]="opt.disabled ? true : null"
            >
              {{ opt.label }}
            </option>
          </ng-container>
        </select>

        <ng-template #projectedNativeOptions>
          <ng-content></ng-content>
        </ng-template>
      </ng-template>
    </div>
  `,
  styles: [
    `
    .ui-select { position: relative; display: block; }
    .ui-select--disabled { opacity: 0.7; pointer-events: none; }

    .ui-select__trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding-right: 2.5rem; background-image: none !important; }
    .ui-select__value { flex: 1 1 auto; min-width: 0; text-align: left; }
    /* Match icon color to current text color (fixes dark-mode blending) */
    .ui-select__icon { display: inline-flex; align-items: center; justify-content: center; color: currentColor; }

    /* Hidden variant used only for single-select custom panel mode */
    .ui-select__native--hidden { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; appearance: none; }

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
      box-shadow: 0 12px 28px -16px color-mix(in srgb, var(--surface-inverse) 50%, transparent), 0 2px 10px -6px color-mix(in srgb, var(--surface-inverse) 35%, transparent);
      transform-origin: top center;
      animation: uiSelectIn 140ms ease-out;
    }

    @keyframes uiSelectIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }

    .ui-select__option {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.625rem 0.5rem 2rem;
      border-radius: 0.5rem;
      cursor: pointer;
      color: var(--text-primary);
      transition: background-color 140ms ease, color 140ms ease;
    }
    .ui-select__option:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
    .ui-select__option.is-selected { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text-primary); }
    .ui-select__option.is-active { background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .ui-select__option:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent); outline-offset: 2px; }
    .ui-select__option.is-disabled { opacity: 0.5; cursor: not-allowed; }

    .ui-select__check { position: absolute; left: 0.5rem; display: inline-flex; width: 1rem; height: 1rem; align-items: center; justify-content: center; color: var(--accent); }
    .ui-select__label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .dark .ui-select__panel { background: color-mix(in srgb, var(--surface-layer-3) 96%, transparent); border-color: color-mix(in srgb, var(--border-overlay) 78%, transparent); }
    /* Ensure trigger text and icon share a high-contrast color in dark mode */
    .dark .ui-select__trigger { color: var(--text-primary); }
    .dark .ui-select__option:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .dark .ui-select__option.is-selected { background: color-mix(in srgb, var(--accent) 22%, transparent); }
    .dark .ui-select__option.is-active { background: color-mix(in srgb, var(--accent) 18%, transparent); }

    @media (forced-colors: active) {
      .ui-select__icon { display: none; }
    }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSelectComponent
  implements ControlValueAccessor, AfterContentInit, OnDestroy
{
  @Input() id?: string;
  @Input() name?: string;
  @Input() multiple: boolean | null = null;
  @Input() size?: number;
  @Input() placeholder?: string;

  disabled = false;
  value: string | string[] | null = null;
  panelOpen = false;
  selectedLabel = '';
  activeIndex = -1;
  panelId = `ui-select-panel-${Math.random().toString(36).slice(2, 9)}`;

  @ViewChild('nativeSelect', { static: true }) nativeSelectRef!: ElementRef<HTMLSelectElement>;

  displayOptions: UiSelectOption[] = [];
  public providedOptions: UiSelectOption[] | null = null;
  private optionsSignature = '';
  private scheduledReconcile = false;
  private pendingForceReconcile = false;
  private destroyed = false;
  private optionsObserver?: MutationObserver;
  private pendingNativeSync = false;

  private onChange: (val: string | string[] | null) => void = () => {};
  // Must be public to be callable from the template (blur) handler
  public onTouched: () => void = () => {};

  private applyProvidedOptions(): void {
    if (!this.providedOptions) {
      return;
    }
    this.displayOptions = [...this.providedOptions];
    this.optionsSignature = this.displayOptions
      .map((option) => `${option.value}::${option.label}::${option.disabled ? '1' : '0'}`)
      .join('|');
    this.syncNativeSelectFromValue();
    this.scheduleNativeSelectSync();
    this.syncLabelFromValue();
    if (this.panelOpen) {
      this.ensureActiveIndex();
    }
  }

  @Input()
  set options(
    options:
      | ReadonlyArray<{ value: string | number; label: string; disabled?: boolean }>
      | null
      | undefined,
  ) {
    if (!options || options.length === 0) {
      this.providedOptions = null;
      this.scheduleProjectedOptionsReconciliation(true);
      return;
    }

    this.providedOptions = options.map((option) => ({
      value: String(option.value),
      label: option.label,
      disabled: !!option.disabled,
    }));
    this.applyProvidedOptions();
  }

  ngAfterContentInit(): void {
    if (!this.providedOptions) {
      this.scheduleProjectedOptionsReconciliation(true);
    } else {
      this.applyProvidedOptions();
    }
    this.observeProjectedOptions();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.optionsObserver?.disconnect();
  }

  writeValue(obj: any): void {
    this.value = obj as string | string[] | null;
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
    this.disabled = isDisabled;
  }

  onSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (this.multiple) {
      const vals = Array.from(target.selectedOptions).map((o) => o.value);
      this.value = vals;
      this.onChange(vals);
    } else {
      const val = target.value;
      this.value = val;
      this.onChange(val);
    }
    this.syncLabelFromValue();
  }

  togglePanel(): void {
    if (this.disabled || this.multiple || (this.size && this.size !== 1)) return;
    this.panelOpen = !this.panelOpen;
    if (this.panelOpen) {
      this.ensureActiveIndex();
    }
  }

  closePanel(): void {
    if (!this.panelOpen) return;
    this.panelOpen = false;
  }

  onOptionClick(opt: { value: string; label: string; disabled: boolean }): void {
    if (opt.disabled) return;
    this.value = opt.value;
    this.onChange(opt.value);
    this.selectedLabel = opt.label;
    this.syncNativeSelectFromValue();
    this.scheduleNativeSelectSync();
    this.closePanel();
  }

  isSelected(val: string): boolean {
    // Normalize current value to a string array for a unified check
    const selected: string[] = Array.isArray(this.value)
      ? this.value
      : this.value != null
        ? [String(this.value)]
        : [];
    return selected.includes(val);
  }

  private syncNativeSelectFromValue(): void {
    const sel = this.nativeSelectRef?.nativeElement;
    if (!sel) {
      return;
    }
    if (this.multiple) {
      const selected = Array.isArray(this.value) ? this.value.map(String) : [];
      Array.from(sel.options).forEach((o) => (o.selected = selected.includes(o.value)));
      return;
    }
    sel.value = this.value != null ? String(this.value) : '';
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
    this.displayOptions = opts.map((o) => ({
      value: o.value,
      label: this.resolveOptionLabel(o),
      disabled: o.disabled,
    }));
  }

  private syncLabelFromValue(): void {
    // Normalize current value to a string array to avoid null/primitive pitfalls
    const selected: string[] = Array.isArray(this.value)
      ? this.value
      : this.value != null
        ? [String(this.value)]
        : [];

    if (this.multiple) {
      // For multiple, show joined labels or empty
      if (selected.length) {
        const labels = this.displayOptions
          .filter((o) => selected.includes(o.value))
          .map((o) => o.label);
        this.selectedLabel = labels.join(', ');
      } else {
        this.selectedLabel = '';
      }
      return;
    }
    const found = this.displayOptions.find((o) => String(o.value) === String(this.value ?? ''));
    this.selectedLabel = found?.label ?? '';
  }

  private ensureActiveIndex(): void {
    const idx = this.displayOptions.findIndex((o) => this.isSelected(o.value));
    this.activeIndex = idx >= 0 ? idx : 0;
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
    if (this.providedOptions) {
      this.displayOptions = [...this.providedOptions];
      this.optionsSignature = this.displayOptions
        .map((option) => `${option.value}::${option.label}::${option.disabled ? '1' : '0'}`)
        .join('|');
      this.syncLabelFromValue();
      if (this.panelOpen) {
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
    if (this.panelOpen) {
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

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.panelOpen) return;
    const host = (ev.target as HTMLElement) as HTMLElement;
    const root = (this.nativeSelectRef?.nativeElement?.parentElement) as HTMLElement | null;
    if (root && host && !root.contains(host)) {
      this.closePanel();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.disabled || this.multiple || (this.size && this.size !== 1)) return;
    const max = this.displayOptions.length - 1;
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        if (!this.panelOpen) { this.panelOpen = true; this.ensureActiveIndex(); return; }
        this.activeIndex = Math.min(max, (this.activeIndex < 0 ? 0 : this.activeIndex + 1));
        break;
      case 'ArrowUp':
        ev.preventDefault();
        if (!this.panelOpen) { this.panelOpen = true; this.ensureActiveIndex(); return; }
        this.activeIndex = Math.max(0, (this.activeIndex < 0 ? 0 : this.activeIndex - 1));
        break;
      case 'Enter':
        if (this.panelOpen && this.activeIndex >= 0) {
          ev.preventDefault();
          const opt = this.displayOptions[this.activeIndex];
          if (opt && !opt.disabled) this.onOptionClick(opt);
        }
        break;
      case 'Escape':
        if (this.panelOpen) { ev.preventDefault(); this.closePanel(); }
        break;
      default:
        break;
    }
  }
}
