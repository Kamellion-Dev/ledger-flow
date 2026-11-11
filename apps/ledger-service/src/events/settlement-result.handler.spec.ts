import { describe, expect, it } from 'vitest';
import type { LedgerEvent, SettlementCompletedData } from '@ledgerflow/contracts';
import {
  SettlementResultHandler,
  type SettlementResultStore,
} from './settlement-result.handler.js';

const event: LedgerEvent<SettlementCompletedData> = {
  eventId: 'settlement-event-001',
  eventName: 'settlement.completed.v1',
  occurredAt: '2026-11-11T20:00:02.000Z',
  correlationId: 'correlation-001',
  data: {
    transferId: 'transfer-001',
    settlementId: 'settlement-001',
    status: 'SETTLED',
    completedAt: '2026-11-11T20:00:02.000Z',
  },
};

class MemorySettlementStore implements SettlementResultStore {
  readonly processed = new Set<string>();
  readonly log: string[] = [];

  apply(result: LedgerEvent<SettlementCompletedData>): Promise<'PROCESSED' | 'DUPLICATE'> {
    if (this.processed.has(result.eventId)) return Promise.resolve('DUPLICATE');
    this.processed.add(result.eventId);
    this.log.push('commit');
    return Promise.resolve('PROCESSED');
  }
}

describe('SettlementResultHandler', () => {
  it('acknowledges only after the settlement result is committed', async () => {
    const store = new MemorySettlementStore();
    const handler = new SettlementResultHandler(store);

    await handler.handle(event, () => store.log.push('ack'));

    expect(store.log).toEqual(['commit', 'ack']);
    expect(store.processed.size).toBe(1);
  });

  it('acknowledges a replay without applying the result twice', async () => {
    const store = new MemorySettlementStore();
    const handler = new SettlementResultHandler(store);
    await handler.handle(event, () => store.log.push('ack'));

    await handler.handle(event, () => store.log.push('ack'));

    expect(store.processed.size).toBe(1);
    expect(store.log).toEqual(['commit', 'ack', 'ack']);
  });
});
