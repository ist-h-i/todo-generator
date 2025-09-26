import { createId } from './create-id';

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = jasmine.createSpy('randomUUID').and.returnValue('uuid-1234');

    const result = createId({ randomUUID });

    expect(result).toBe('uuid-1234');
    expect(randomUUID).toHaveBeenCalled();
  });

  it('falls back to Math.random based UUID when crypto.randomUUID is unavailable', () => {
    const mathRandomSpy = spyOn(Math, 'random').and.returnValue(0);

    try {
      const result = createId({});

      expect(result).toBe('00000000-0000-4000-8000-000000000000');
    } finally {
      mathRandomSpy.and.callThrough();
    }
  });
});
