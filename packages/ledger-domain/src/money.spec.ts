import { describe, expect, it } from 'vitest';
import { assertMinorUnits } from './money.js';

describe('assertMinorUnits', () => {
  it('returns a positive safe integer unchanged', () => {
    expect(assertMinorUnits(2500)).toBe(2500);
  });

  it.each([0, -1, 12.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe money value %s',
    (value) => {
      expect(() => assertMinorUnits(value)).toThrow('positive safe integer');
    },
  );
});
