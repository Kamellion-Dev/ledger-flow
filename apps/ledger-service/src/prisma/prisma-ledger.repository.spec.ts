import { describe, expect, it } from 'vitest';
import type {
  CreateTransferAggregate,
  CreateFxConversionAggregate,
  CreateWalletFundingAggregate,
} from '../ledger/ledger-repository.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { PrismaLedgerRepository } from './prisma-ledger.repository.js';

const aggregate: CreateTransferAggregate = {
  transfer: {
    id: 'transfer-001',
    idempotencyKey: 'concurrent-transfer-001',
    sourceAccountId: 'wallet-alice',
    destinationAccountId: 'wallet-bob',
    amountMinor: 2_500,
    currency: 'USD',
    reference: 'Dinner split',
    status: 'PENDING',
    journalId: 'journal-001',
    createdAt: '2026-11-12T10:00:00.000Z',
  },
  journal: {
    id: 'journal-001',
    transferId: 'transfer-001',
    currency: 'USD',
    currencies: ['USD'],
    reference: 'Dinner split',
    createdAt: '2026-11-12T10:00:00.000Z',
    postings: [
      {
        id: 'posting-001',
        accountId: 'wallet-alice',
        accountCode: 'WALLET-ALICE',
        accountName: 'Alice Wallet',
        side: 'DEBIT',
        amountMinor: 2_500,
        currency: 'USD',
      },
      {
        id: 'posting-002',
        accountId: 'wallet-bob',
        accountCode: 'WALLET-BOB',
        accountName: 'Bob Wallet',
        side: 'CREDIT',
        amountMinor: 2_500,
        currency: 'USD',
      },
    ],
  },
  idempotency: {
    key: 'concurrent-transfer-001',
    operation: 'CREATE_TRANSFER',
    requestHash: 'request-hash',
    resourceId: 'transfer-001',
    createdAt: '2026-11-12T10:00:00.000Z',
  },
  outbox: {
    id: 'event-001',
    eventName: 'transfer.posted.v1',
    correlationId: 'correlation-001',
    event: {
      eventId: 'event-001',
      eventName: 'transfer.posted.v1',
      occurredAt: '2026-11-12T10:00:00.000Z',
      correlationId: 'correlation-001',
      data: {
        transferId: 'transfer-001',
        journalId: 'journal-001',
        amountMinor: 2_500,
        currency: 'USD',
      },
    },
    status: 'PENDING',
    attemptCount: 0,
    createdAt: '2026-11-12T10:00:00.000Z',
  },
};

const fundingAggregate: CreateWalletFundingAggregate = {
  funding: {
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
  },
  journal: {
    id: 'funding-journal-001',
    fundingId: 'funding-001',
    currency: 'USD',
    currencies: ['USD'],
    reference: 'Bank cash-in',
    createdAt: '2026-11-13T19:00:00.000Z',
    postings: [
      {
        id: 'funding-posting-001',
        accountId: 'platform-cash',
        accountCode: '1000-CASH',
        accountName: 'Platform Cash',
        side: 'DEBIT',
        amountMinor: 5_000,
        currency: 'USD',
      },
      {
        id: 'funding-posting-002',
        accountId: 'wallet-alice',
        accountCode: '2100-ALICE',
        accountName: 'Alice Wallet',
        side: 'CREDIT',
        amountMinor: 5_000,
        currency: 'USD',
      },
    ],
  },
  idempotency: {
    key: 'funding-key-001',
    operation: 'CREATE_WALLET_FUNDING',
    requestHash: 'funding-request-hash',
    resourceId: 'funding-001',
    createdAt: '2026-11-13T19:00:00.000Z',
  },
};

const fxAggregate: CreateFxConversionAggregate = {
  conversion: {
    id: 'fx-conversion-001',
    idempotencyKey: 'fx-key-001',
    quoteId: 'quote-001',
    sourceAccountId: 'wallet-alice',
    destinationAccountId: 'wallet-alice-eur',
    sourceAmountMinor: 10_000,
    destinationAmountMinor: 9_024,
    sourceCurrency: 'USD',
    destinationCurrency: 'EUR',
    rateDecimal: '0.90244',
    journalId: 'fx-journal-001',
    reference: 'Travel money',
    createdAt: '2026-11-13T20:05:00.000Z',
  },
  journal: {
    id: 'fx-journal-001',
    fxConversionId: 'fx-conversion-001',
    currencies: ['USD', 'EUR'],
    reference: 'Travel money',
    createdAt: '2026-11-13T20:05:00.000Z',
    postings: [
      {
        id: 'p1',
        accountId: 'wallet-alice',
        accountCode: 'W-USD',
        accountName: 'Alice USD',
        side: 'DEBIT',
        amountMinor: 10_000,
        currency: 'USD',
      },
      {
        id: 'p2',
        accountId: 'platform-usd',
        accountCode: 'C-USD',
        accountName: 'Cash USD',
        side: 'CREDIT',
        amountMinor: 10_000,
        currency: 'USD',
      },
      {
        id: 'p3',
        accountId: 'platform-eur',
        accountCode: 'C-EUR',
        accountName: 'Cash EUR',
        side: 'DEBIT',
        amountMinor: 9_024,
        currency: 'EUR',
      },
      {
        id: 'p4',
        accountId: 'wallet-alice-eur',
        accountCode: 'W-EUR',
        accountName: 'Alice EUR',
        side: 'CREDIT',
        amountMinor: 9_024,
        currency: 'EUR',
      },
    ],
  },
  idempotency: {
    key: 'fx-key-001',
    operation: 'CREATE_FX_CONVERSION',
    requestHash: 'fx-request-hash',
    resourceId: 'fx-conversion-001',
    createdAt: '2026-11-13T20:05:00.000Z',
  },
  sourceCashAccountId: 'platform-usd',
  destinationCashAccountId: 'platform-eur',
};

describe('PrismaLedgerRepository concurrency safety', () => {
  it('lists each customer wallet once with its currency balances', async () => {
    const prisma = {
      wallet: {
        findMany: async () => [
          {
            id: 'wallet-alice',
            ownerName: 'Alice',
            balances: [
              { currency: 'USD', account: { balanceMinor: 10_000n } },
              { currency: 'EUR', account: { balanceMinor: 2_500n } },
            ],
          },
        ],
      },
    } as unknown as PrismaClient;

    await expect(new PrismaLedgerRepository(prisma).listWallets()).resolves.toEqual([
      {
        id: 'wallet-alice',
        ownerName: 'Alice',
        balances: [
          { currency: 'USD', balanceMinor: 10_000 },
          { currency: 'EUR', balanceMinor: 2_500 },
        ],
      },
    ]);
  });

  it('creates a zero-balance liability account and wallet mapping in one transaction', async () => {
    const accountCreates: unknown[] = [];
    const balanceCreates: unknown[] = [];
    const transaction = {
      account: {
        create: async (input: unknown) => {
          accountCreates.push(input);
          return {};
        },
      },
      walletBalance: {
        create: async (input: unknown) => {
          balanceCreates.push(input);
          return {};
        },
      },
    };
    const prisma = {
      $transaction: async <T>(work: (client: typeof transaction) => Promise<T>) =>
        work(transaction),
    } as unknown as PrismaClient;

    await new PrismaLedgerRepository(prisma).transaction((unitOfWork) =>
      unitOfWork.createWalletBalance({
        walletId: 'wallet-alice',
        currency: 'EGP',
        account: {
          id: 'wallet-alice-egp',
          code: '2100-WALLET-ALICE-EGP',
          name: 'Alice EGP Balance',
          type: 'LIABILITY',
          currency: 'EGP',
          balanceMinor: 0,
        },
      }),
    );

    expect(accountCreates).toEqual([
      {
        data: {
          id: 'wallet-alice-egp',
          code: '2100-WALLET-ALICE-EGP',
          name: 'Alice EGP Balance',
          type: 'LIABILITY',
          currency: 'EGP',
          balanceMinor: 0n,
        },
      },
    ]);
    expect(balanceCreates).toEqual([
      {
        data: {
          walletId: 'wallet-alice',
          currency: 'EGP',
          accountId: 'wallet-alice-egp',
        },
      },
    ]);
  });

  it('persists all four FX balance movements, conversion, journal, and idempotency atomically', async () => {
    const updateManyCalls: unknown[] = [];
    const updateCalls: unknown[] = [];
    const conversionCreates: unknown[] = [];
    const journalCreates: unknown[] = [];
    const transaction = {
      account: {
        updateMany: async (input: unknown) => {
          updateManyCalls.push(input);
          return { count: 1 };
        },
        update: async (input: unknown) => {
          updateCalls.push(input);
          return {};
        },
      },
      fxConversion: { create: async (input: unknown) => conversionCreates.push(input) },
      journal: { create: async (input: unknown) => journalCreates.push(input) },
      idempotencyRecord: { create: async () => ({}) },
    };
    const prisma = {
      $transaction: async <T>(work: (client: typeof transaction) => Promise<T>) =>
        work(transaction),
    } as unknown as PrismaClient;

    await new PrismaLedgerRepository(prisma).transaction((unitOfWork) =>
      unitOfWork.createFxConversion(fxAggregate),
    );

    expect(updateManyCalls).toHaveLength(2);
    expect(updateCalls).toHaveLength(2);
    expect(conversionCreates).toHaveLength(1);
    expect(journalCreates).toHaveLength(1);
    const journalInput = journalCreates[0] as {
      data: {
        currency: null;
        postings: { create: Array<{ currency: string; amountMinor: bigint }> };
      };
    };
    expect(journalInput.data.currency).toBeNull();
    expect(journalInput.data.postings.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'USD', amountMinor: 10_000n }),
        expect.objectContaining({ currency: 'EUR', amountMinor: 9_024n }),
      ]),
    );
  });

  it('takes a transaction-scoped PostgreSQL advisory lock for an idempotency key', async () => {
    const lockCalls: unknown[][] = [];
    const transaction = {
      $queryRaw: async (...input: unknown[]) => {
        lockCalls.push(input);
        return [{ pg_advisory_xact_lock: null }];
      },
    };
    const prisma = {
      $transaction: async <T>(work: (client: typeof transaction) => Promise<T>) =>
        work(transaction),
    } as unknown as PrismaClient;
    const repository = new PrismaLedgerRepository(prisma);

    await repository.transaction((unitOfWork) =>
      unitOfWork.lockIdempotencyKey('concurrent-funding-001'),
    );

    expect(lockCalls).toHaveLength(1);
    expect(String(lockCalls[0]?.[0])).toContain('::text');
    expect(lockCalls[0]?.[1]).toBe('concurrent-funding-001');
  });

  it('increments asset and wallet balances while persisting one funding journal atomically', async () => {
    const accountUpdates: unknown[] = [];
    const fundingCreates: unknown[] = [];
    const journalCreates: unknown[] = [];
    const transaction = {
      account: {
        update: async (input: unknown) => {
          accountUpdates.push(input);
          return {};
        },
      },
      walletFunding: {
        create: async (input: unknown) => {
          fundingCreates.push(input);
          return {};
        },
      },
      journal: {
        create: async (input: unknown) => {
          journalCreates.push(input);
          return {};
        },
      },
      idempotencyRecord: { create: async () => ({}) },
    };
    const prisma = {
      $transaction: async <T>(work: (client: typeof transaction) => Promise<T>) =>
        work(transaction),
    } as unknown as PrismaClient;
    const repository = new PrismaLedgerRepository(prisma);

    await repository.transaction((unitOfWork) => unitOfWork.createWalletFunding(fundingAggregate));

    expect(accountUpdates).toEqual([
      {
        where: { id: 'platform-cash' },
        data: { balanceMinor: { increment: 5_000n } },
      },
      {
        where: { id: 'wallet-alice' },
        data: { balanceMinor: { increment: 5_000n } },
      },
    ]);
    expect(fundingCreates).toHaveLength(1);
    expect(journalCreates).toHaveLength(1);
  });

  it('rejects a transfer when the source balance changed before persistence', async () => {
    const transaction = {
      account: {
        update: async () => ({}),
        updateMany: async () => ({ count: 0 }),
      },
      transfer: { create: async () => ({}) },
      journal: { create: async () => ({}) },
      idempotencyRecord: { create: async () => ({}) },
      outboxEvent: { create: async () => ({}) },
    };
    const prisma = {
      $transaction: async <T>(work: (client: typeof transaction) => Promise<T>) =>
        work(transaction),
    } as unknown as PrismaClient;
    const repository = new PrismaLedgerRepository(prisma);

    await expect(
      repository.transaction((unitOfWork) => unitOfWork.createTransfer(aggregate)),
    ).rejects.toThrow('Source account balance changed or is insufficient');
  });
});
