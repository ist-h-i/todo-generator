import { AbstractControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface SignalFormState<TValue> {
  readonly value: Signal<TValue>;
  readonly status: Signal<AbstractControl['status']>;
}

export function signalForms<TValue>(control: AbstractControl<TValue>): SignalFormState<TValue> {
  const valueChanges = control.valueChanges as unknown as Observable<TValue>;
  const value = toSignal(valueChanges, {
    initialValue: control.value as TValue,
  });
  const status = toSignal(control.statusChanges, {
    initialValue: control.status,
  });

  return { value, status };
}
