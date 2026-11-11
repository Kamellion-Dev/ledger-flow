import type { LedgerEvent } from '@ledgerflow/contracts';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { OutboxRecord } from '../ledger/ledger-repository.js';
import type { OutboxStore } from './outbox-dispatcher.js';

export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listPending(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      eventName: row.eventName,
      correlationId: row.correlationId,
      event: row.payload as unknown as LedgerEvent,
      status: row.status,
      attemptCount: row.attemptCount,
      createdAt: row.createdAt.toISOString(),
      ...(row.publishedAt ? { publishedAt: row.publishedAt.toISOString() } : {}),
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), attemptCount: { increment: 1 } },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  }
}
