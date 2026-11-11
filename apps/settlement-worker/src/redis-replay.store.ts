import type { LedgerEvent, SettlementCompletedData } from '@ledgerflow/contracts';
import type { Redis } from 'ioredis';
import type { SettlementReplayStore } from './settlement-processor.js';

const RETENTION_SECONDS = 7 * 24 * 60 * 60;

export class RedisReplayStore implements SettlementReplayStore {
  constructor(private readonly redis: Redis) {}

  async get(sourceEventId: string): Promise<LedgerEvent<SettlementCompletedData> | undefined> {
    const value = await this.redis.get(this.key(sourceEventId));
    return value ? (JSON.parse(value) as LedgerEvent<SettlementCompletedData>) : undefined;
  }

  async save(
    sourceEventId: string,
    event: LedgerEvent<SettlementCompletedData>,
  ): Promise<void> {
    await this.redis.set(this.key(sourceEventId), JSON.stringify(event), 'EX', RETENTION_SECONDS);
  }

  private key(sourceEventId: string): string {
    return `ledgerflow:settlement:${sourceEventId}`;
  }
}
