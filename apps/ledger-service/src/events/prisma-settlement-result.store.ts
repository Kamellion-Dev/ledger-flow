import type { LedgerEvent, SettlementCompletedData } from '@ledgerflow/contracts';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { SettlementResultStore } from './settlement-result.handler.js';

export class PrismaSettlementResultStore implements SettlementResultStore {
  constructor(private readonly prisma: PrismaClient) {}

  async apply(event: LedgerEvent<SettlementCompletedData>): Promise<'PROCESSED' | 'DUPLICATE'> {
    return this.prisma.$transaction(async (transaction) => {
      const processed = await transaction.processedEvent.findUnique({
        where: { eventId: event.eventId },
      });
      if (processed) return 'DUPLICATE';

      await transaction.settlement.upsert({
        where: { transferId: event.data.transferId },
        create: {
          id: event.data.settlementId,
          transferId: event.data.transferId,
          eventId: event.eventId,
          status: event.data.status,
          completedAt: new Date(event.data.completedAt),
        },
        update: {
          eventId: event.eventId,
          status: event.data.status,
          attemptCount: { increment: 1 },
          completedAt: new Date(event.data.completedAt),
        },
      });
      await transaction.transfer.update({
        where: { id: event.data.transferId },
        data: {
          status: event.data.status,
          settledAt: event.data.status === 'SETTLED' ? new Date(event.data.completedAt) : null,
        },
      });
      await transaction.processedEvent.create({
        data: {
          eventId: event.eventId,
          eventName: event.eventName,
          processedAt: new Date(event.occurredAt),
        },
      });
      return 'PROCESSED';
    });
  }
}
