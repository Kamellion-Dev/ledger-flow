import { describe, expect, it } from 'vitest';
import type { CreateTransferAggregate } from '../ledger/ledger-repository.js';
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
      },
      {
        id: 'posting-002',
        accountId: 'wallet-bob',
        accountCode: 'WALLET-BOB',
        accountName: 'Bob Wallet',
        side: 'CREDIT',
        amountMinor: 2_500,
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

describe('PrismaLedgerRepository concurrency safety', () => {
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
