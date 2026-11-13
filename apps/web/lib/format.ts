import type { Currency } from '@ledgerflow/contracts';

export function formatMoney(amountMinor: number, currency: Currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

export function parseMoneyInputToMinor(value: string): number {
  const input = value.trim();
  const parts = input.split('.');
  if (parts.length > 2 || !parts[0] || !parts[0].split('').every(isDigit)) {
    throw new Error('Enter a valid amount with no more than two decimal places.');
  }
  const fraction = parts[1] ?? '';
  if (fraction.length > 2 || !fraction.split('').every(isDigit)) {
    throw new Error('Enter a valid amount with no more than two decimal places.');
  }
  const minor = BigInt(parts[0]) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large.');
  return Number(minor);
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
