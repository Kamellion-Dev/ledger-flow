import { describe, expect, it } from 'vitest';
import { convertMinorUnits, parseDecimalRatio } from './fx-rate.js';

describe('FX rate arithmetic', () => {
  it('parses provider decimal text into an exact reduced ratio', () => {
    expect(parseDecimalRatio('0.90244')).toEqual({
      numerator: 22_561n,
      denominator: 25_000n,
      decimal: '0.90244',
    });
    expect(parseDecimalRatio('001.2500')).toEqual({
      numerator: 5n,
      denominator: 4n,
      decimal: '1.25',
    });
  });

  it('converts minor units with integer half-up rounding', () => {
    const rate = parseDecimalRatio('0.90244');

    expect(convertMinorUnits(10_000, rate.numerator, rate.denominator)).toBe(9_024);
    expect(convertMinorUnits(1, 1n, 2n)).toBe(1);
    expect(convertMinorUnits(1, 49n, 100n)).toBe(0);
  });

  it.each(['', '0', '0.000', '-1', '+1', '1e2', '.5', '1.', 'abc', '1,2'])(
    'rejects malformed or non-positive provider rate %j',
    (value) => {
      expect(() => parseDecimalRatio(value)).toThrow('positive decimal');
    },
  );

  it('rejects unsafe amounts and invalid ratios', () => {
    expect(() => convertMinorUnits(Number.MAX_SAFE_INTEGER + 1, 1n, 1n)).toThrow('safe integer');
    expect(() => convertMinorUnits(100, 0n, 1n)).toThrow('positive');
    expect(() => convertMinorUnits(100, 1n, 0n)).toThrow('positive');
  });
});
