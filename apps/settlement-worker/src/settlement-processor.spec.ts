import { describe, expect, it } from 'vitest';
import type {
  LedgerEvent,
  SettlementCompletedData,
  TransferPostedData,
} from '@ledgerflow/contracts';
import {
  SettlementProcessor,
  type SettlementEventPublisher,
  type SettlementReplayStore,
} from './settlement-processor.js';

const posted: LedgerEvent<TransferPostedData> = {
  eventId: 'transfer-event-001',
  eventName: 'transfer.posted.v1',
  occurredAt: '2026-11-11T20:00:00.000Z',
  correlationId: 'correlation-001',
  data: {
    transferId: 'transfer-001',
    journalId: 'journal-001',
    amountMinor: 2500,
    currency: 'USD',
  },
};

class MemoryReplayStore implements SettlementReplayStore {
  readonly events = new Map<string, LedgerEvent<SettlementCompletedData>>();
  get(sourceEventId: string) {
    return Promise.resolve(this.events.get(sourceEventId));
  }
  save(sourceEventId: string, event: LedgerEvent<SettlementCompletedData>) {
    this.events.set(sourceEventId, event);
    return Promise.resolve();
  }
}

class RecordingPublisher implements SettlementEventPublisher {
  readonly events: LedgerEvent<SettlementCompletedData>[] = [];
  publish(event: LedgerEvent<SettlementCompletedData>) {
    this.events.push(event);
    return Promise.resolve();
  }
}

function createFixture() {
  const store = new MemoryReplayStore();
  const publisher = new RecordingPublisher();
  const processor = new SettlementProcessor(
    store,
    publisher,
    () => new Date('2026-11-11T20:00:02.000Z'),
  );
  return { store, publisher, processor };
}

describe('SettlementProcessor', () => {
  it('publishes a deterministic settlement result and acknowledges after saving replay state', async () => {
    const { store, publisher, processor } = createFixture();
    const log: string[] = [];
    const originalSave = store.save.bind(store);
    store.save = async (...args) => {
      await originalSave(...args);
      log.push('save');
    };

    await processor.process(posted, () => log.push('ack'));

    expect(publisher.events).toEqual([
      {
        eventId: 'settlement:transfer-event-001',
        eventName: 'settlement.completed.v1',
        occurredAt: '2026-11-11T20:00:02.000Z',
        correlationId: 'correlation-001',
        data: {
          transferId: 'transfer-001',
          settlementId: 'settlement:transfer-001',
          status: 'SETTLED',
          completedAt: '2026-11-11T20:00:02.000Z',
        },
      },
    ]);
    expect(log).toEqual(['save', 'ack']);
  });

  it('replays the same deterministic result for a duplicate delivery', async () => {
    const { publisher, processor } = createFixture();
    await processor.process(posted, () => undefined);

    await processor.process(posted, () => undefined);

    expect(publisher.events).toHaveLength(2);
    expect(publisher.events[1]).toEqual(publisher.events[0]);
  });

  it('does not save or acknowledge when publishing fails', async () => {
    const store = new MemoryReplayStore();
    let acknowledged = false;
    const processor = new SettlementProcessor(
      store,
      { publish: () => Promise.reject(new Error('broker unavailable')) },
      () => new Date('2026-11-11T20:00:02.000Z'),
    );

    await expect(processor.process(posted, () => (acknowledged = true))).rejects.toThrow(
      'broker unavailable',
    );
    expect(store.events.size).toBe(0);
    expect(acknowledged).toBe(false);
  });

  it('rejects an event with an unexpected name without acknowledging it', async () => {
    const { publisher, processor } = createFixture();
    let acknowledged = false;

    await expect(
      processor.process(
        { ...posted, eventName: 'settlement.completed.v1' } as LedgerEvent<TransferPostedData>,
        () => (acknowledged = true),
      ),
    ).rejects.toThrow('transfer.posted.v1');
    expect(publisher.events).toHaveLength(0);
    expect(acknowledged).toBe(false);
  });
});
