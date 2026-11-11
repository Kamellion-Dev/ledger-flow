import type { LedgerEvent, SettlementCompletedData } from '@ledgerflow/contracts';

export interface SettlementResultStore {
  apply(event: LedgerEvent<SettlementCompletedData>): Promise<'PROCESSED' | 'DUPLICATE'>;
}

export class SettlementResultHandler {
  constructor(private readonly store: SettlementResultStore) {}

  async handle(event: LedgerEvent<SettlementCompletedData>, acknowledge: () => void): Promise<void> {
    await this.store.apply(event);
    acknowledge();
  }
}
