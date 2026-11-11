import { createHash } from 'node:crypto';
import type {
  AccountView,
  CreateTransferCommand,
  DashboardSummary,
  JournalView,
  LedgerEvent,
  Page,
  ReverseTransferCommand,
  SettlementView,
  TransferPostedData,
  TransferView,
} from '@ledgerflow/contracts';
import { LedgerEventName } from '@ledgerflow/contracts';
import { buildTransferJournal } from '@ledgerflow/ledger-domain';
import type {
  CreateTransferAggregate,
  IdempotencyRecord,
  LedgerRepository,
  OutboxRecord,
  ReverseTransferAggregate,
} from './ledger-repository.js';

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used with a different payload');
    this.name = 'IdempotencyConflictError';
  }
}

export class LedgerResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found`);
    this.name = 'LedgerResourceNotFoundError';
  }
}

export class TransferStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferStateError';
  }
}

export interface LedgerRuntime {
  nextId(): string;
  now(): Date;
}

export class LedgerApplicationService {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly runtime: LedgerRuntime,
  ) {}

  async createTransfer(
    command: CreateTransferCommand,
    correlationId: string,
  ): Promise<TransferView> {
    const requestHash = hashRequest({
      operation: 'CREATE_TRANSFER',
      sourceAccountId: command.sourceAccountId,
      destinationAccountId: command.destinationAccountId,
      amountMinor: command.amountMinor,
      currency: command.currency,
      reference: command.reference.trim(),
    });

    return this.repository.transaction(async (unitOfWork) => {
      const replay = await unitOfWork.findIdempotency(command.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.operation !== 'CREATE_TRANSFER') {
          throw new IdempotencyConflictError();
        }
        const original = await unitOfWork.findTransfer(replay.resourceId);
        if (!original) {
          throw new LedgerResourceNotFoundError('Idempotent transfer result');
        }
        return original;
      }

      const source = await unitOfWork.findAccount(command.sourceAccountId);
      const destination = await unitOfWork.findAccount(command.destinationAccountId);
      if (!source || !destination) {
        throw new LedgerResourceNotFoundError('Transfer account');
      }

      const draft = buildTransferJournal(command, { source, destination });
      const createdAt = this.runtime.now().toISOString();
      const transferId = this.runtime.nextId();
      const journalId = this.runtime.nextId();
      const transfer: TransferView = {
        id: transferId,
        idempotencyKey: command.idempotencyKey,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amountMinor: command.amountMinor,
        currency: command.currency,
        reference: draft.reference,
        status: 'PENDING',
        journalId,
        createdAt,
      };
      const journal: JournalView = {
        id: journalId,
        transferId,
        currency: draft.currency,
        reference: draft.reference,
        createdAt,
        postings: draft.postings.map((posting) => {
          const account = posting.accountId === source.id ? source : destination;
          return {
            id: this.runtime.nextId(),
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            side: posting.side,
            amountMinor: posting.amountMinor,
          };
        }),
      };
      const eventId = this.runtime.nextId();
      const event: LedgerEvent<TransferPostedData> = {
        eventId,
        eventName: LedgerEventName.TransferPosted,
        occurredAt: createdAt,
        correlationId,
        data: {
          transferId,
          journalId,
          amountMinor: command.amountMinor,
          currency: command.currency,
        },
      };
      const idempotency: IdempotencyRecord = {
        key: command.idempotencyKey,
        operation: 'CREATE_TRANSFER',
        requestHash,
        resourceId: transferId,
        createdAt,
      };
      const outbox: OutboxRecord = {
        id: eventId,
        eventName: event.eventName,
        correlationId,
        event,
        status: 'PENDING',
        attemptCount: 0,
        createdAt,
      };
      const aggregate: CreateTransferAggregate = {
        transfer,
        journal,
        idempotency,
        outbox,
      };

      await unitOfWork.createTransfer(aggregate);
      return transfer;
    });
  }

  async reverseTransfer(
    command: ReverseTransferCommand,
    _correlationId: string,
  ): Promise<TransferView> {
    const requestHash = hashRequest({
      operation: 'REVERSE_TRANSFER',
      transferId: command.transferId,
      reason: command.reason.trim(),
    });

    return this.repository.transaction(async (unitOfWork) => {
      const replay = await unitOfWork.findIdempotency(command.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.operation !== 'REVERSE_TRANSFER') {
          throw new IdempotencyConflictError();
        }
        const original = await unitOfWork.findTransfer(replay.resourceId);
        if (!original) {
          throw new LedgerResourceNotFoundError('Idempotent reversal result');
        }
        return original;
      }

      const transfer = await unitOfWork.findTransfer(command.transferId);
      if (!transfer) {
        throw new LedgerResourceNotFoundError('Transfer');
      }
      if (transfer.status === 'REVERSED') {
        throw new TransferStateError('Transfer is already reversed');
      }
      if (transfer.status === 'FAILED') {
        throw new TransferStateError('A failed transfer cannot be reversed');
      }
      const originalJournal = await unitOfWork.findJournal(transfer.journalId);
      const source = await unitOfWork.findAccount(transfer.sourceAccountId);
      const destination = await unitOfWork.findAccount(transfer.destinationAccountId);
      if (!originalJournal || !source || !destination) {
        throw new LedgerResourceNotFoundError('Transfer ledger data');
      }

      const reversedAt = this.runtime.now().toISOString();
      const updatedTransfer: TransferView = { ...transfer, status: 'REVERSED', reversedAt };
      const journal: JournalView = {
        id: this.runtime.nextId(),
        transferId: transfer.id,
        currency: transfer.currency,
        reference: `Reversal: ${command.reason.trim()}`,
        reversalOfJournalId: originalJournal.id,
        createdAt: reversedAt,
        postings: originalJournal.postings.map((posting) => ({
          ...posting,
          id: this.runtime.nextId(),
          side: posting.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        })),
      };
      const idempotency: IdempotencyRecord = {
        key: command.idempotencyKey,
        operation: 'REVERSE_TRANSFER',
        requestHash,
        resourceId: transfer.id,
        createdAt: reversedAt,
      };
      const aggregate: ReverseTransferAggregate = {
        transfer: updatedTransfer,
        journal,
        idempotency,
      };

      await unitOfWork.reverseTransfer(aggregate);
      return updatedTransfer;
    });
  }

  listAccounts(): Promise<AccountView[]> {
    return this.repository.listAccounts();
  }

  async listTransfers(page: number, pageSize: number): Promise<Page<TransferView>> {
    const result = await this.repository.listTransfers(page, pageSize);
    return { ...result, page, pageSize };
  }

  async listSettlements(page: number, pageSize: number): Promise<Page<SettlementView>> {
    const result = await this.repository.listSettlements(page, pageSize);
    return { ...result, page, pageSize };
  }

  async getJournal(id: string): Promise<JournalView> {
    const journal = await this.repository.findJournal(id);
    if (!journal) throw new LedgerResourceNotFoundError('Journal');
    return journal;
  }

  async getSummary(): Promise<DashboardSummary> {
    const [{ items: transfers }, accounts] = await Promise.all([
      this.repository.listTransfers(1, 1_000),
      this.repository.listAccounts(),
    ]);
    const byHour = new Map<string, number>();
    for (const transfer of transfers) {
      const date = new Date(transfer.createdAt);
      date.setUTCMinutes(0, 0, 0);
      const hour = date.toISOString();
      byHour.set(hour, (byHour.get(hour) ?? 0) + transfer.amountMinor);
    }

    return {
      totalVolumeMinor: transfers.reduce((total, transfer) => total + transfer.amountMinor, 0),
      settledVolumeMinor: transfers
        .filter((transfer) => transfer.status === 'SETTLED')
        .reduce((total, transfer) => total + transfer.amountMinor, 0),
      pendingCount: transfers.filter((transfer) => transfer.status === 'PENDING').length,
      settledCount: transfers.filter((transfer) => transfer.status === 'SETTLED').length,
      failedCount: transfers.filter((transfer) => transfer.status === 'FAILED').length,
      accountCount: accounts.length,
      recentTransfers: transfers.slice(0, 5),
      volumeByHour: [...byHour.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([hour, amountMinor]) => ({ hour, amountMinor })),
      generatedAt: this.runtime.now().toISOString(),
    };
  }
}

function hashRequest(value: Record<string, string | number>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
