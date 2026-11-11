import { GrpcInternalException } from '@nestjs/microservices';
import { describe, expect, it } from 'vitest';
import { LedgerApplicationService } from '../ledger/ledger-application.service.js';
import { InMemoryLedgerRepository } from '../../test/in-memory-ledger.repository.js';
import { LedgerGrpcController } from './ledger-grpc.controller.js';

function createController() {
  const repository = new InMemoryLedgerRepository([
    {
      id: 'wallet-alice',
      code: 'WALLET-ALICE',
      name: 'Alice Wallet',
      type: 'LIABILITY',
      currency: 'USD',
      balanceMinor: 10_000,
    },
    {
      id: 'wallet-bob',
      code: 'WALLET-BOB',
      name: 'Bob Wallet',
      type: 'LIABILITY',
      currency: 'USD',
      balanceMinor: 5_000,
    },
  ]);
  let sequence = 0;
  const service = new LedgerApplicationService(repository, {
    nextId: () => `id-${++sequence}`,
    now: () => new Date('2026-11-11T20:00:00.000Z'),
  });
  return new LedgerGrpcController(service);
}

describe('LedgerGrpcController', () => {
  it('maps a protobuf transfer request into the application command', async () => {
    const controller = createController();

    const transfer = await controller.createTransfer({
      idempotencyKey: 'grpc-demo-001',
      sourceAccountId: 'wallet-alice',
      destinationAccountId: 'wallet-bob',
      amountMinor: 2500,
      currency: 'USD',
      reference: 'Dinner split',
      correlationId: 'correlation-001',
    });

    expect(transfer).toMatchObject({
      id: 'id-1',
      journalId: 'id-2',
      status: 'PENDING',
      amountMinor: 2500,
    });
  });

  it('reports service liveness without querying dependencies', () => {
    expect(createController().health()).toEqual({ status: 'ok' });
  });

  it('hides unexpected infrastructure errors behind an internal status', async () => {
    const service = {
      createTransfer: async () => {
        throw new Error('database connection details');
      },
    } as unknown as LedgerApplicationService;
    const controller = new LedgerGrpcController(service);

    await expect(
      controller.createTransfer({
        idempotencyKey: 'grpc-demo-002',
        sourceAccountId: 'wallet-alice',
        destinationAccountId: 'wallet-bob',
        amountMinor: 500,
        currency: 'USD',
        reference: 'Private failure',
      }),
    ).rejects.toEqual(new GrpcInternalException('Ledger operation failed'));
  });
});
