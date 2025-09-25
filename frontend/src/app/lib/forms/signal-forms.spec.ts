import { createSignalForm } from './signal-forms';

describe('createSignalForm', () => {
  it('exposes writable controls backed by signals', () => {
    const form = createSignalForm({ email: 'user@example.com', password: 'secret' });

    expect(form.controls.email.value()).toBe('user@example.com');
    expect(form.controls.password.value()).toBe('secret');

    form.controls.email.setValue('next@example.com');
    form.controls.password.updateValue((previous) => `${previous}!`);

    expect(form.controls.email.value()).toBe('next@example.com');
    expect(form.controls.password.value()).toBe('secret!');
    expect(form.value()).toEqual({ email: 'next@example.com', password: 'secret!' });
  });

  it('patches a subset of fields without mutating others', () => {
    const form = createSignalForm({ email: 'user@example.com', password: 'secret' });

    form.patchValue({ password: 'updated' });

    expect(form.value()).toEqual({ email: 'user@example.com', password: 'updated' });

    form.patchValue({ email: 'new@example.com', missing: 'ignore-me' } as unknown as {
      email: string;
      password: string;
    });

    expect(form.value()).toEqual({ email: 'new@example.com', password: 'updated' });
  });

  it('resets to the initial value or the provided override', () => {
    const form = createSignalForm({ email: 'user@example.com', password: 'secret' });

    form.patchValue({ email: 'new@example.com', password: 'updated' });
    expect(form.value()).toEqual({ email: 'new@example.com', password: 'updated' });

    form.reset();
    expect(form.value()).toEqual({ email: 'user@example.com', password: 'secret' });

    form.reset({ email: 'override@example.com', password: 'override' });
    expect(form.value()).toEqual({ email: 'override@example.com', password: 'override' });
  });

  it('invokes submit handlers with the latest snapshot', () => {
    const form = createSignalForm({ email: 'user@example.com', password: 'secret' });

    const handler =
      jasmine.createSpy<(value: { email: string; password: string }) => void>('handler');
    const submit = form.submit(handler);

    form.controls.password.setValue('updated');
    submit();

    expect(handler).toHaveBeenCalledWith({ email: 'user@example.com', password: 'updated' });
  });
});
