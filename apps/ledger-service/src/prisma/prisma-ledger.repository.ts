import type { AccountView, JournalView, SettlementView, TransferView } from '@ledgerflow/contracts';
import type {
  CreateTransferAggregate,
  IdempotencyRecord,
  LedgerRepository,
  LedgerUnitOfWork,
  ReverseTransferAggregate,
} from '../ledger/ledger-repository.js';
import { TransferStateError } from '../ledger/ledger-application.service.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { mapAccount, mapJournal, mapSettlement, mapTransfer } from './prisma-mappers.js';

const journalInclude = { postings: { include: { account: true } } } as const;

export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (unitOfWork: LedgerUnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((transaction) => work(new PrismaLedgerUnitOfWork(transaction)));
  }

  async listAccounts(): Promise<AccountView[]> {
    const rows = await this.prisma.account.findMany({ orderBy: { code: 'asc' } });
    return rows.map(mapAccount);
  }

  async listTransfers(
    page: number,
    pageSize: number,
  ): Promise<{ items: TransferView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transfer.count(),
    ]);
    return { items: rows.map(mapTransfer), total };
  }

  async listSettlements(
    page: number,
    pageSize: number,
  ): Promise<{ items: SettlementView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.settlement.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.settlement.count(),
    ]);
    return { items: rows.map(mapSettlement), total };
  }

  async findJournal(id: string): Promise<JournalView | undefined> {
    const row = await this.prisma.journal.findUnique({ where: { id }, include: journalInclude });
    return row ? mapJournal(row) : undefined;
  }
}

class PrismaLedgerUnitOfWork implements LedgerUnitOfWork {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async findAccount(id: string): Promise<AccountView | undefined> {
    const row = await this.transaction.account.findUnique({ where: { id } });
    return row ? mapAccount(row) : undefined;
  }

  async findTransfer(id: string): Promise<TransferView | undefined> {
    const row = await this.transaction.transfer.findUnique({ where: { id } });
    return row ? mapTransfer(row) : undefined;
  }

  async findJournal(id: string): Promise<JournalView | undefined> {
    const row = await this.transaction.journal.findUnique({
      where: { id },
      include: journalInclude,
    });
    return row ? mapJournal(row) : undefined;
  }

  async findIdempotency(key: string): Promise<IdempotencyRecord | undefined> {
    const row = await this.transaction.idempotencyRecord.findUnique({ where: { key } });
    return row
      ? {
          key: row.key,
          operation: row.operation,
          requestHash: row.requestHash,
          resourceId: row.resourceId,
          createdAt: row.createdAt.toISOString(),
        }
      : undefined;
  }

  async createTransfer(aggregate: CreateTransferAggregate): Promise<void> {
    const amountMinor = BigInt(aggregate.transfer.amountMinor);
    const sourceUpdate = await this.transaction.account.updateMany({
      where: {
        id: aggregate.transfer.sourceAccountId,
        balanceMinor: { gte: amountMinor },
      },
      data: { balanceMinor: { decrement: amountMinor } },
    });
    if (sourceUpdate.count !== 1) {
      throw new TransferStateError('Source account balance changed or is insufficient');
    }
    await this.transaction.account.update({
      where: { id: aggregate.transfer.destinationAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });
    await this.transaction.transfer.create({
      data: {
        id: aggregate.transfer.id,
        idempotencyKey: aggregate.transfer.idempotencyKey,
        sourceAccountId: aggregate.transfer.sourceAccountId,
        destinationAccountId: aggregate.transfer.destinationAccountId,
        amountMinor: BigInt(aggregate.transfer.amountMinor),
        currency: aggregate.transfer.currency,
        reference: aggregate.transfer.reference,
        status: aggregate.transfer.status,
        journalId: aggregate.transfer.journalId,
        createdAt: new Date(aggregate.transfer.createdAt),
      },
    });
    await this.transaction.journal.create({
      data: {
        id: aggregate.journal.id,
        transferId: aggregate.journal.transferId,
        currency: aggregate.journal.currency,
        reference: aggregate.journal.reference,
        createdAt: new Date(aggregate.journal.createdAt),
        postings: {
          create: aggregate.journal.postings.map((posting) => ({
            id: posting.id,
            accountId: posting.accountId,
            side: posting.side,
            amountMinor: BigInt(posting.amountMinor),
            createdAt: new Date(aggregate.journal.createdAt),
          })),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        ...aggregate.idempotency,
        createdAt: new Date(aggregate.idempotency.createdAt),
      },
    });
    await this.transaction.outboxEvent.create({
      data: {
        id: aggregate.outbox.id,
        eventName: aggregate.outbox.eventName,
        correlationId: aggregate.outbox.correlationId,
        payload: toJson(aggregate.outbox.event),
        status: aggregate.outbox.status,
        attemptCount: aggregate.outbox.attemptCount,
        createdAt: new Date(aggregate.outbox.createdAt),
      },
    });
  }

  async reverseTransfer(aggregate: ReverseTransferAggregate): Promise<void> {
    const transferUpdate = await this.transaction.transfer.updateMany({
      where: { id: aggregate.transfer.id, status: { not: 'REVERSED' } },
      data: {
        status: aggregate.transfer.status,
        reversedAt: aggregate.transfer.reversedAt ? new Date(aggregate.transfer.reversedAt) : null,
      },
    });
    if (transferUpdate.count !== 1) {
      throw new TransferStateError('Transfer was already reversed');
    }

    const amountMinor = BigInt(aggregate.transfer.amountMinor);
    await this.transaction.account.update({
      where: { id: aggregate.transfer.sourceAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });
    const destinationUpdate = await this.transaction.account.updateMany({
      where: {
        id: aggregate.transfer.destinationAccountId,
        balanceMinor: { gte: amountMinor },
      },
      data: { balanceMinor: { decrement: amountMinor } },
    });
    if (destinationUpdate.count !== 1) {
      throw new TransferStateError('Destination account cannot fund the reversal');
    }
    await this.transaction.journal.create({
      data: {
        id: aggregate.journal.id,
        transferId: aggregate.journal.transferId,
        currency: aggregate.journal.currency,
        reference: aggregate.journal.reference,
        reversalOfJournalId: aggregate.journal.reversalOfJournalId ?? null,
        createdAt: new Date(aggregate.journal.createdAt),
        postings: {
          create: aggregate.journal.postings.map((posting) => ({
            id: posting.id,
            accountId: posting.accountId,
            side: posting.side,
            amountMinor: BigInt(posting.amountMinor),
            createdAt: new Date(aggregate.journal.createdAt),
          })),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        ...aggregate.idempotency,
        createdAt: new Date(aggregate.idempotency.createdAt),
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
