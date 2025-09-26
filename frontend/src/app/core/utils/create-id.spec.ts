import { createId } from './create-id';

describe('createId', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as { crypto?: Crypto }).crypto;
    }
  });

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = jasmine.createSpy('randomUUID').and.returnValue('uuid-1234');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: { randomUUID } as Partial<Crypto>,
    });

    const result = createId();

    expect(result).toBe('uuid-1234');
    expect(randomUUID).toHaveBeenCalled();
  });

  it('falls back to Math.random based UUID when crypto.randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      value: {} as Partial<Crypto>,
    });

    const result = createId();

    expect(result).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  });
});
