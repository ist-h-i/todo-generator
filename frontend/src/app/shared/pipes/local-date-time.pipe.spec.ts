import { LocalDateTimePipe } from './local-date-time.pipe';

describe('LocalDateTimePipe', () => {
  let pipe: LocalDateTimePipe;

  beforeEach(() => {
    pipe = new LocalDateTimePipe();
  });

  it('formats ISO timestamps in the provided timezone', () => {
    const result = pipe.transform('2024-01-01T12:34:56Z', 'yyyy/MM/dd HH:mm', 'UTC');
    expect(result).toBe('2024/01/01 12:34');
  });

  it('formats plain dates without a time component', () => {
    const result = pipe.transform('2024-03-15', 'yyyy/MM/dd', 'UTC');
    expect(result).toBe('2024/03/15');
  });

  it('falls back to an empty string for invalid inputs', () => {
    expect(pipe.transform('not-a-date', 'yyyy/MM/dd', 'UTC')).toBe('');
  });
});
