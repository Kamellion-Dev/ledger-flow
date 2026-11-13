import { describe, expect, it } from 'vitest';
import {
  mapAccount,
  mapFxConversion,
  mapFxQuote,
  mapJournal,
  mapTransfer,
  mapWallet,
  mapWalletFunding,
  toSafeNumber,
} from './prisma-mappers.js';

describe('Prisma ledger mappers', () => {
  it('groups currency balances under one customer wallet without changing their amounts', () => {
    expect(
      mapWallet({
        id: 'wallet-alice',
        ownerName: 'Alice',
        balances: [
          { currency: 'USD', account: { balanceMinor: 10_000n } },
          { currency: 'EUR', account: { balanceMinor: 2_500n } },
        ],
      }),
    ).toEqual({
      id: 'wallet-alice',
      ownerName: 'Alice',
      balances: [
        { currency: 'USD', balanceMinor: 10_000 },
        { currency: 'EUR', balanceMinor: 2_500 },
      ],
    });
  });

  it('maps immutable FX quote and conversion snapshots without losing bigint precision', () => {
    expect(
      mapFxQuote({
        id: 'quote-001',
        provider: 'frankfurter',
        sourceCurrency: 'USD',
        destinationCurrency: 'EUR',
        sourceAmountMinor: 10_000n,
        destinationAmountMinor: 9_024n,
        rateDecimal: '0.90244',
        rateNumerator: 22_561n,
        rateDenominator: 25_000n,
        rateDate: new Date('2026-11-13T00:00:00.000Z'),
        createdAt: new Date('2026-11-13T20:00:00.000Z'),
        expiresAt: new Date('2026-11-13T20:15:00.000Z'),
      }),
    ).toMatchObject({
      rateNumerator: '22561',
      rateDenominator: '25000',
      rateDate: '2026-11-13',
    });
    expect(
      mapFxConversion({
        id: 'conversion-001',
        idempotencyKey: 'fx-key-001',
        quoteId: 'quote-001',
        sourceAccountId: 'wallet-usd',
        destinationAccountId: 'wallet-eur',
        sourceAmountMinor: 10_000n,
        destinationAmountMinor: 9_024n,
        sourceCurrency: 'USD',
        destinationCurrency: 'EUR',
        rateDecimal: '0.90244',
        journalId: 'journal-001',
        reference: 'Travel money',
        createdAt: new Date('2026-11-13T20:05:00.000Z'),
      }),
    ).toMatchObject({ sourceAmountMinor: 10_000, destinationAmountMinor: 9_024 });
  });

  it('maps bigint amounts and dates into transport-safe values', () => {
    expect(
      mapTransfer({
        id: 'transfer-001',
        idempotencyKey: 'key-001',
        sourceAccountId: 'wallet-alice',
        destinationAccountId: 'wallet-bob',
        amountMinor: 2500n,
        currency: 'USD',
        reference: 'Dinner split',
        status: 'PENDING',
        journalId: 'journal-001',
        createdAt: new Date('2026-11-11T20:00:00.000Z'),
        settledAt: null,
        reversedAt: null,
      }),
    ).toEqual({
      id: 'transfer-001',
      idempotencyKey: 'key-001',
      sourceAccountId: 'wallet-alice',
      destinationAccountId: 'wallet-bob',
      amountMinor: 2500,
      currency: 'USD',
      reference: 'Dinner split',
      status: 'PENDING',
      journalId: 'journal-001',
      createdAt: '2026-11-11T20:00:00.000Z',
    });
  });

  it('maps a journal with populated posting account labels', () => {
    expect(
      mapJournal({
        id: 'journal-001',
        transferId: 'transfer-001',
        fundingId: null,
        fxConversionId: null,
        currency: 'USD',
        reference: 'Dinner split',
        reversalOfJournalId: null,
        createdAt: new Date('2026-11-11T20:00:00.000Z'),
        postings: [
          {
            id: 'posting-001',
            accountId: 'wallet-alice',
            side: 'DEBIT',
            amountMinor: 2500n,
            currency: 'USD',
            account: { code: 'WALLET-ALICE', name: 'Alice Wallet' },
          },
        ],
      }),
    ).toEqual({
      id: 'journal-001',
      transferId: 'transfer-001',
      currency: 'USD',
      currencies: ['USD'],
      reference: 'Dinner split',
      createdAt: '2026-11-11T20:00:00.000Z',
      postings: [
        {
          id: 'posting-001',
          accountId: 'wallet-alice',
          accountCode: 'WALLET-ALICE',
          accountName: 'Alice Wallet',
          side: 'DEBIT',
          amountMinor: 2500,
          currency: 'USD',
        },
      ],
    });
  });

  it('maps wallet funding with its populated wallet name', () => {
    expect(
      mapWalletFunding({
        id: 'funding-001',
        idempotencyKey: 'funding-key-001',
        fundingAccountId: 'platform-cash',
        walletAccountId: 'wallet-alice',
        amountMinor: 5_000n,
        currency: 'USD',
        reference: 'Bank cash-in',
        journalId: 'funding-journal-001',
        createdAt: new Date('2026-11-13T19:00:00.000Z'),
        walletAccount: { name: 'Alice Wallet' },
      }),
    ).toEqual({
      id: 'funding-001',
      idempotencyKey: 'funding-key-001',
      fundingAccountId: 'platform-cash',
      walletAccountId: 'wallet-alice',
      walletName: 'Alice Wallet',
      amountMinor: 5_000,
      currency: 'USD',
      reference: 'Bank cash-in',
      journalId: 'funding-journal-001',
      createdAt: '2026-11-13T19:00:00.000Z',
    });
  });

  it('maps an account balance without losing precision', () => {
    expect(
      mapAccount({
        id: 'wallet-alice',
        code: 'WALLET-ALICE',
        name: 'Alice Wallet',
        type: 'LIABILITY',
        currency: 'USD',
        balanceMinor: 10_000n,
      }),
    ).toMatchObject({ balanceMinor: 10_000, currency: 'USD' });
  });

  it('rejects a database amount that cannot be represented safely in JavaScript', () => {
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow('safe integer');
  });
});
