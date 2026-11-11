import { describe, expect, it } from 'vitest';
import { mapAccount, mapJournal, mapTransfer, toSafeNumber } from './prisma-mappers.js';

describe('Prisma ledger mappers', () => {
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
            account: { code: 'WALLET-ALICE', name: 'Alice Wallet' },
          },
        ],
      }),
    ).toEqual({
      id: 'journal-001',
      transferId: 'transfer-001',
      currency: 'USD',
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
        },
      ],
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
