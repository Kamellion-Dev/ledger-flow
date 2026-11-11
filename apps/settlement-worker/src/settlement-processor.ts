import type {
  LedgerEvent,
  SettlementCompletedData,
  TransferPostedData,
} from '@ledgerflow/contracts';
import { LedgerEventName } from '@ledgerflow/contracts';

export interface SettlementReplayStore {
  get(sourceEventId: string): Promise<LedgerEvent<SettlementCompletedData> | undefined>;
  save(sourceEventId: string, event: LedgerEvent<SettlementCompletedData>): Promise<void>;
}

export interface SettlementEventPublisher {
  publish(event: LedgerEvent<SettlementCompletedData>): Promise<void>;
}

export class SettlementProcessor {
  constructor(
    private readonly replayStore: SettlementReplayStore,
    private readonly publisher: SettlementEventPublisher,
    private readonly now: () => Date,
  ) {}

  async process(event: LedgerEvent<TransferPostedData>, acknowledge: () => void): Promise<void> {
    if (event.eventName !== LedgerEventName.TransferPosted) {
      throw new Error(`Settlement worker accepts ${LedgerEventName.TransferPosted} events only`);
    }

    const replay = await this.replayStore.get(event.eventId);
    if (replay) {
      await this.publisher.publish(replay);
      acknowledge();
      return;
    }

    const completedAt = this.now().toISOString();
    const result: LedgerEvent<SettlementCompletedData> = {
      eventId: `settlement:${event.eventId}`,
      eventName: LedgerEventName.SettlementCompleted,
      occurredAt: completedAt,
      correlationId: event.correlationId,
      data: {
        transferId: event.data.transferId,
        settlementId: `settlement:${event.data.transferId}`,
        status: 'SETTLED',
        completedAt,
      },
    };

    await this.publisher.publish(result);
    await this.replayStore.save(event.eventId, result);
    acknowledge();
  }
}
