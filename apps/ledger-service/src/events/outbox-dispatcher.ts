import type { OutboxRecord } from '../ledger/ledger-repository.js';

export interface OutboxStore {
  listPending(limit: number): Promise<OutboxRecord[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export interface EventPublisher {
  publish(event: OutboxRecord): Promise<void>;
}

export class OutboxDispatcher {
  constructor(
    private readonly store: OutboxStore,
    private readonly publisher: EventPublisher,
    private readonly afterPublished?: () => void,
  ) {}

  async runOnce(limit = 25): Promise<number> {
    const records = await this.store.listPending(limit);
    let published = 0;

    for (const record of records) {
      try {
        await this.publisher.publish(record);
        await this.store.markPublished(record.id);
        this.afterPublished?.();
        published += 1;
      } catch (error) {
        await this.store.markFailed(record.id);
        throw error;
      }
    }

    return published;
  }
}
