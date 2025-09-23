import { Signal, WritableSignal, computed, signal } from '@angular/core';

/**
 * Signal-backed control contract for template binding.
 */
export interface SignalControl<T> {
  readonly value: Signal<T>;
  readonly setValue: (value: T) => void;
  readonly updateValue: (updater: (previous: T) => T) => void;
}

/**
 * Aggregate form utilities exposing signals and helpers for submission.
 */
export interface SignalForm<T extends Record<string, unknown>> {
  readonly controls: { [K in keyof T]: SignalControl<T[K]> };
  readonly value: Signal<T>;
  readonly patchValue: (patch: Partial<T>) => void;
  readonly reset: (value?: T) => void;
  readonly submit: (handler: (value: T) => void) => VoidFunction;
}

const buildControl = <T>(initialValue: T): SignalControl<T> => {
  const store: WritableSignal<T> = signal(initialValue);

  return {
    value: computed(() => store()),
    setValue: (value: T): void => {
      store.set(value);
    },
    updateValue: (updater: (previous: T) => T): void => {
      store.update((current) => updater(current));
    },
  };
};

/**
 * Creates a form abstraction powered by Angular signals instead of reactive forms.
 *
 * @param initialValue - Starting state for the form controls.
 * @returns Configured signal-based form helpers.
 */
export const createSignalForm = <T extends Record<string, unknown>>(
  initialValue: T,
): SignalForm<T> => {
  const controlEntries = Object.entries(initialValue).map(
    ([key, value]) => [key, buildControl(value as T[keyof T])] as const,
  );

  const controls = Object.fromEntries(controlEntries) as unknown as {
    [K in keyof T]: SignalControl<T[K]>;
  };

  const valueSignal = computed(() => {
    const snapshot = {} as T;
    for (const entry of Object.entries(controls) as [keyof T, SignalControl<T[keyof T]>][]) {
      const [key, control] = entry;
      snapshot[key] = control.value() as T[keyof T];
    }
    return snapshot;
  });

  const patchValue = (patch: Partial<T>): void => {
    for (const entry of Object.entries(patch) as [keyof T, T[keyof T]][]) {
      const [key, value] = entry;
      if (controls[key]) {
        controls[key].setValue(value);
      }
    }
  };

  const reset = (value?: T): void => {
    const target = value ?? initialValue;
    for (const entry of Object.entries(controls) as [keyof T, SignalControl<T[keyof T]>][]) {
      const [key, control] = entry;
      control.setValue(target[key]);
    }
  };

  const submit =
    (handler: (value: T) => void): VoidFunction =>
    () => {
      handler(valueSignal());
    };

  return {
    controls,
    value: valueSignal,
    patchValue,
    reset,
    submit,
  };
};
