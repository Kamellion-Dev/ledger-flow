import { describe, expect, it } from 'vitest';
import type { OutboxRecord } from '../ledger/ledger-repository.js';
import {
  OutboxDispatcher,
  type EventPublisher,
  type OutboxStore,
} from './outbox-dispatcher.js';

function record(): OutboxRecord {
  return {
    id: 'event-001',
    eventName: 'transfer.posted.v1',
    correlationId: 'correlation-001',
    event: {
      eventId: 'event-001',
      eventName: 'transfer.posted.v1',
      occurredAt: '2026-11-11T20:00:00.000Z',
      correlationId: 'correlation-001',
      data: { transferId: 'transfer-001' },
    },
    status: 'PENDING',
    attemptCount: 0,
    createdAt: '2026-11-11T20:00:00.000Z',
  };
}

class MemoryOutboxStore implements OutboxStore {
  readonly pending = [record()];
  readonly published: string[] = [];
  readonly failed: string[] = [];

  listPending(): Promise<OutboxRecord[]> {
    return Promise.resolve([...this.pending]);
  }
  markPublished(id: string): Promise<void> {
    this.published.push(id);
    return Promise.resolve();
  }
  markFailed(id: string): Promise<void> {
    this.failed.push(id);
    return Promise.resolve();
  }
}

describe('OutboxDispatcher', () => {
  it('marks an event published only after the broker confirms it', async () => {
    const log: string[] = [];
    const store = new MemoryOutboxStore();
    const publisher: EventPublisher = {
      publish: async (event) => {
        log.push(`publish:${event.id}`);
      },
    };
    const dispatcher = new OutboxDispatcher(store, publisher, () => log.push('mark'));

    const count = await dispatcher.runOnce();

    expect(count).toBe(1);
    expect(store.published).toEqual(['event-001']);
    expect(store.failed).toEqual([]);
    expect(log).toEqual(['publish:event-001', 'mark']);
  });

  it('records a failed attempt and leaves the event pending', async () => {
    const store = new MemoryOutboxStore();
    const publisher: EventPublisher = {
      publish: () => Promise.reject(new Error('broker unavailable')),
    };
    const dispatcher = new OutboxDispatcher(store, publisher);

    await expect(dispatcher.runOnce()).rejects.toThrow('broker unavailable');
    expect(store.published).toEqual([]);
    expect(store.failed).toEqual(['event-001']);
  });
});
