export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyValidationError';
  }
}

export function assertMinorUnits(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new MoneyValidationError('Amount must be a positive safe integer in minor units');
  }

  return value;
}
