import { assertMinorUnits } from './money.js';

export interface DecimalRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly decimal: string;
}

export class FxRateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxRateValidationError';
  }
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let currentLeft = left;
  let currentRight = right;
  while (currentRight !== 0n) {
    const remainder = currentLeft % currentRight;
    currentLeft = currentRight;
    currentRight = remainder;
  }
  return currentLeft;
}

function isAsciiDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

export function parseDecimalRatio(value: string): DecimalRatio {
  if (!value || value.trim() !== value) {
    throw new FxRateValidationError('FX rate must be a positive decimal');
  }

  const separatorIndex = value.indexOf('.');
  if (separatorIndex !== -1 && value.indexOf('.', separatorIndex + 1) !== -1) {
    throw new FxRateValidationError('FX rate must be a positive decimal');
  }

  const whole = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
  const fraction = separatorIndex === -1 ? '' : value.slice(separatorIndex + 1);
  if (!whole || (separatorIndex !== -1 && !fraction)) {
    throw new FxRateValidationError('FX rate must be a positive decimal');
  }
  for (const character of whole + fraction) {
    if (!isAsciiDigit(character)) {
      throw new FxRateValidationError('FX rate must be a positive decimal');
    }
  }

  const normalizedWhole = whole.replace(/^0+(?=\d)/u, '');
  const normalizedFraction = fraction.replace(/0+$/u, '');
  const decimal = normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
  const scale = 10n ** BigInt(fraction.length);
  const unscaled = BigInt(whole + fraction);
  if (unscaled <= 0n) {
    throw new FxRateValidationError('FX rate must be a positive decimal');
  }
  const divisor = greatestCommonDivisor(unscaled, scale);

  return Object.freeze({
    numerator: unscaled / divisor,
    denominator: scale / divisor,
    decimal,
  });
}

export function convertMinorUnits(
  amountMinor: number,
  numerator: bigint,
  denominator: bigint,
): number {
  assertMinorUnits(amountMinor);
  if (numerator <= 0n || denominator <= 0n) {
    throw new FxRateValidationError('FX ratio terms must be positive');
  }

  const scaled = BigInt(amountMinor) * numerator;
  const quotient = scaled / denominator;
  const remainder = scaled % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new FxRateValidationError('Converted amount must be a safe integer');
  }
  return Number(rounded);
}
