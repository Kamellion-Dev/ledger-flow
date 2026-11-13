import { describe, expect, it } from 'vitest';
import type { CreateFxConversionCommand, FxQuoteView } from '@ledgerflow/contracts';
import { buildFxConversionJournal, type FxConversionAccount } from './fx-conversion.js';

const command: CreateFxConversionCommand = {
  idempotencyKey: 'fx-conversion-001',
  quoteId: 'quote-001',
  sourceAccountId: 'wallet-alice-usd',
  destinationAccountId: 'wallet-alice-eur',
  reference: 'Travel money',
};

const quote: FxQuoteView = {
  id: 'quote-001',
  provider: 'frankfurter',
  sourceCurrency: 'USD',
  destinationCurrency: 'EUR',
  sourceAmountMinor: 10_000,
  destinationAmountMinor: 9_024,
  rateDecimal: '0.90244',
  rateNumerator: '22561',
  rateDenominator: '25000',
  rateDate: '2026-11-13',
  createdAt: '2026-11-13T20:00:00.000Z',
  expiresAt: '2026-11-13T20:15:00.000Z',
};

const accounts: {
  sourceWallet: FxConversionAccount;
  destinationWallet: FxConversionAccount;
  sourceCash: FxConversionAccount;
  destinationCash: FxConversionAccount;
} = {
  sourceWallet: {
    id: 'wallet-alice-usd',
    type: 'LIABILITY',
    currency: 'USD',
    balanceMinor: 20_000,
  },
  destinationWallet: {
    id: 'wallet-alice-eur',
    type: 'LIABILITY',
    currency: 'EUR',
    balanceMinor: 0,
  },
  sourceCash: {
    id: 'platform-cash-usd',
    type: 'ASSET',
    currency: 'USD',
    balanceMinor: 50_000,
  },
  destinationCash: {
    id: 'platform-cash-eur',
    type: 'ASSET',
    currency: 'EUR',
    balanceMinor: 50_000,
  },
};

describe('buildFxConversionJournal', () => {
  it('creates two independently balanced, currency-tagged legs', () => {
    const journal = buildFxConversionJournal(command, quote, accounts);

    expect(journal).toEqual({
      currencies: ['USD', 'EUR'],
      reference: 'Travel money',
      postings: [
        {
          accountId: 'wallet-alice-usd',
          currency: 'USD',
          side: 'DEBIT',
          amountMinor: 10_000,
        },
        {
          accountId: 'platform-cash-usd',
          currency: 'USD',
          side: 'CREDIT',
          amountMinor: 10_000,
        },
        {
          accountId: 'platform-cash-eur',
          currency: 'EUR',
          side: 'DEBIT',
          amountMinor: 9_024,
        },
        {
          accountId: 'wallet-alice-eur',
          currency: 'EUR',
          side: 'CREDIT',
          amountMinor: 9_024,
        },
      ],
    });
    expect(Object.isFrozen(journal)).toBe(true);
    expect(Object.isFrozen(journal.postings)).toBe(true);
  });

  it('rejects a quote that does not match the command', () => {
    expect(() =>
      buildFxConversionJournal({ ...command, quoteId: 'other' }, quote, accounts),
    ).toThrow('Quote does not match');
  });

  it('rejects mismatched wallet and platform cash currencies', () => {
    expect(() =>
      buildFxConversionJournal(command, quote, {
        ...accounts,
        destinationWallet: { ...accounts.destinationWallet, currency: 'GBP' },
      }),
    ).toThrow('currencies');
  });

  it('rejects accounts with the wrong accounting roles', () => {
    expect(() =>
      buildFxConversionJournal(command, quote, {
        ...accounts,
        sourceCash: { ...accounts.sourceCash, type: 'LIABILITY' },
      }),
    ).toThrow('asset');
  });

  it('rejects insufficient source wallet balance', () => {
    expect(() =>
      buildFxConversionJournal(command, quote, {
        ...accounts,
        sourceWallet: { ...accounts.sourceWallet, balanceMinor: 9_999 },
      }),
    ).toThrow('wallet balance');
  });

  it('rejects insufficient source platform cash balance', () => {
    expect(() =>
      buildFxConversionJournal(command, quote, {
        ...accounts,
        sourceCash: { ...accounts.sourceCash, balanceMinor: 9_999 },
      }),
    ).toThrow('cash balance');
  });

  it('rejects same-currency conversion quotes', () => {
    expect(() =>
      buildFxConversionJournal(
        command,
        { ...quote, destinationCurrency: 'USD' },
        {
          ...accounts,
          destinationWallet: { ...accounts.destinationWallet, currency: 'USD' },
          destinationCash: { ...accounts.destinationCash, currency: 'USD' },
        },
      ),
    ).toThrow('different currencies');
  });
});
