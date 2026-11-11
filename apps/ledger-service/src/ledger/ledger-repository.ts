import type {
  AccountView,
  JournalView,
  LedgerEvent,
  SettlementView,
  TransferView,
} from '@ledgerflow/contracts';

export interface IdempotencyRecord {
  readonly key: string;
  readonly operation: 'CREATE_TRANSFER' | 'REVERSE_TRANSFER';
  readonly requestHash: string;
  readonly resourceId: string;
  readonly createdAt: string;
}

export interface OutboxRecord {
  readonly id: string;
  readonly eventName: string;
  readonly correlationId: string;
  readonly event: LedgerEvent;
  readonly status: 'PENDING' | 'PUBLISHED';
  readonly attemptCount: number;
  readonly createdAt: string;
  readonly publishedAt?: string;
}

export interface LedgerState {
  readonly accounts: AccountView[];
  readonly transfers: TransferView[];
  readonly journals: JournalView[];
  readonly settlements: SettlementView[];
  readonly idempotency: IdempotencyRecord[];
  readonly outbox: OutboxRecord[];
  readonly processedEventIds: string[];
}

export interface CreateTransferAggregate {
  readonly transfer: TransferView;
  readonly journal: JournalView;
  readonly idempotency: IdempotencyRecord;
  readonly outbox: OutboxRecord;
  readonly sourceBalanceMinor: number;
  readonly destinationBalanceMinor: number;
}

export interface ReverseTransferAggregate {
  readonly transfer: TransferView;
  readonly journal: JournalView;
  readonly idempotency: IdempotencyRecord;
  readonly sourceBalanceMinor: number;
  readonly destinationBalanceMinor: number;
}

export interface LedgerUnitOfWork {
  findAccount(id: string): Promise<AccountView | undefined>;
  findTransfer(id: string): Promise<TransferView | undefined>;
  findJournal(id: string): Promise<JournalView | undefined>;
  findIdempotency(key: string): Promise<IdempotencyRecord | undefined>;
  createTransfer(aggregate: CreateTransferAggregate): Promise<void>;
  reverseTransfer(aggregate: ReverseTransferAggregate): Promise<void>;
}

export interface LedgerRepository {
  transaction<T>(work: (unitOfWork: LedgerUnitOfWork) => Promise<T>): Promise<T>;
  listAccounts(): Promise<AccountView[]>;
  listTransfers(page: number, pageSize: number): Promise<{ items: TransferView[]; total: number }>;
  listSettlements(
    page: number,
    pageSize: number,
  ): Promise<{ items: SettlementView[]; total: number }>;
  findJournal(id: string): Promise<JournalView | undefined>;
}
