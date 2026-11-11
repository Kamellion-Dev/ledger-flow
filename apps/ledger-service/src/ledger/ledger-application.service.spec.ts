import { describe, expect, it } from 'vitest';
import type { CreateTransferCommand } from '@ledgerflow/contracts';
import {
  IdempotencyConflictError,
  LedgerApplicationService,
} from './ledger-application.service.js';
import { InMemoryLedgerRepository } from '../../test/in-memory-ledger.repository.js';

const alice = {
  id: 'wallet-alice',
  code: 'WALLET-ALICE',
  name: 'Alice Wallet',
  type: 'LIABILITY' as const,
  currency: 'USD' as const,
  balanceMinor: 10_000,
};

const bob = {
  id: 'wallet-bob',
  code: 'WALLET-BOB',
  name: 'Bob Wallet',
  type: 'LIABILITY' as const,
  currency: 'USD' as const,
  balanceMinor: 5_000,
};

const command: CreateTransferCommand = {
  idempotencyKey: 'transfer-demo-001',
  sourceAccountId: alice.id,
  destinationAccountId: bob.id,
  amountMinor: 2_500,
  currency: 'USD',
  reference: 'Dinner split',
};

function createFixture() {
  const repository = new InMemoryLedgerRepository([alice, bob]);
  const ids = [
    'transfer-001',
    'journal-001',
    'posting-001',
    'posting-002',
    'event-001',
    'reversal-transfer-001',
    'reversal-journal-001',
    'reversal-posting-001',
    'reversal-posting-002',
    'reversal-event-001',
  ];
  const service = new LedgerApplicationService(repository, {
    nextId: () => ids.shift() ?? 'unexpected-id',
    now: () => new Date('2026-11-11T20:00:00.000Z'),
  });
  return { repository, service };
}

describe('LedgerApplicationService', () => {
  it('atomically creates one transfer, balanced journal, balance update, and outbox event', async () => {
    const { repository, service } = createFixture();

    const result = await service.createTransfer(command, 'correlation-001');
    const state = repository.inspect();

    expect(result).toMatchObject({
      id: 'transfer-001',
      status: 'PENDING',
      journalId: 'journal-001',
      amountMinor: 2500,
    });
    expect(state.journals).toHaveLength(1);
    expect(state.journals[0]?.postings).toEqual([
      expect.objectContaining({ accountId: alice.id, side: 'DEBIT', amountMinor: 2500 }),
      expect.objectContaining({ accountId: bob.id, side: 'CREDIT', amountMinor: 2500 }),
    ]);
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(7500);
    expect(state.accounts.find((account) => account.id === bob.id)?.balanceMinor).toBe(7500);
    expect(state.outbox).toEqual([
      expect.objectContaining({
        id: 'event-001',
        eventName: 'transfer.posted.v1',
        correlationId: 'correlation-001',
      }),
    ]);
  });

  it('returns the original result when the same idempotency key and payload are replayed', async () => {
    const { repository, service } = createFixture();

    const first = await service.createTransfer(command, 'correlation-001');
    const replay = await service.createTransfer(command, 'correlation-002');

    expect(replay).toEqual(first);
    expect(repository.inspect().transfers).toHaveLength(1);
    expect(repository.inspect().outbox).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const { service } = createFixture();
    await service.createTransfer(command, 'correlation-001');

    await expect(
      service.createTransfer({ ...command, amountMinor: 2600 }, 'correlation-002'),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('rolls back all records when the source balance is insufficient', async () => {
    const { repository, service } = createFixture();

    await expect(
      service.createTransfer({ ...command, amountMinor: 10_001 }, 'correlation-001'),
    ).rejects.toThrow('Insufficient balance');

    const state = repository.inspect();
    expect(state.transfers).toHaveLength(0);
    expect(state.journals).toHaveLength(0);
    expect(state.outbox).toHaveLength(0);
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(10_000);
  });

  it('reverses a posted transfer with a new compensating journal', async () => {
    const { repository, service } = createFixture();
    const transfer = await service.createTransfer(command, 'correlation-001');

    const reversed = await service.reverseTransfer(
      { transferId: transfer.id, idempotencyKey: 'reverse-demo-001', reason: 'Operator correction' },
      'correlation-002',
    );

    const state = repository.inspect();
    expect(reversed.status).toBe('REVERSED');
    expect(state.journals).toHaveLength(2);
    expect(state.journals[1]).toMatchObject({
      reversalOfJournalId: 'journal-001',
      postings: [
        expect.objectContaining({ accountId: alice.id, side: 'CREDIT', amountMinor: 2500 }),
        expect.objectContaining({ accountId: bob.id, side: 'DEBIT', amountMinor: 2500 }),
      ],
    });
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(10_000);
    expect(state.accounts.find((account) => account.id === bob.id)?.balanceMinor).toBe(5_000);
  });

  it('returns a dashboard summary from persisted transfer state', async () => {
    const { service } = createFixture();
    const transfer = await service.createTransfer(command, 'correlation-001');

    const summary = await service.getSummary();
    const page = await service.listTransfers(1, 25);
    const journal = await service.getJournal(transfer.journalId);

    expect(summary).toMatchObject({
      totalVolumeMinor: 2500,
      settledVolumeMinor: 0,
      pendingCount: 1,
      settledCount: 0,
      failedCount: 0,
      accountCount: 2,
      recentTransfers: [expect.objectContaining({ id: 'transfer-001' })],
      volumeByHour: [{ hour: '2026-11-11T20:00:00.000Z', amountMinor: 2500 }],
      generatedAt: '2026-11-11T20:00:00.000Z',
    });
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 25 });
    expect(journal.id).toBe('journal-001');
  });
});
