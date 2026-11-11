import { describe, expect, it } from 'vitest';
import { assertBalanced } from './journal.js';

describe('assertBalanced', () => {
  it('accepts equal debit and credit totals', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'wallet-alice', side: 'DEBIT', amountMinor: 2500 },
        { accountId: 'wallet-bob', side: 'CREDIT', amountMinor: 2500 },
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced journal', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'wallet-alice', side: 'DEBIT', amountMinor: 2500 },
        { accountId: 'wallet-bob', side: 'CREDIT', amountMinor: 2400 },
      ]),
    ).toThrow('Debits and credits must balance');
  });

  it('rejects a journal with fewer than two postings', () => {
    expect(() =>
      assertBalanced([{ accountId: 'wallet-alice', side: 'DEBIT', amountMinor: 2500 }]),
    ).toThrow('at least two postings');
  });
});
