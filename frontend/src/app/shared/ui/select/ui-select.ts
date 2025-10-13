import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  Input,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

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
    <select
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
      <ng-content></ng-content>
    </select>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSelectComponent implements ControlValueAccessor {
  @Input() id?: string;
  @Input() name?: string;
  @Input() multiple: boolean | null = null;
  @Input() size?: number;

  disabled = false;
  value: any = '';

  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(obj: any): void {
    this.value = obj;
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
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
  }
}

