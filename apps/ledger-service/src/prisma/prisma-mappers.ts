import type {
  AccountType,
  AccountView,
  Currency,
  JournalView,
  PostingSide,
  SettlementStatus,
  SettlementView,
  TransferStatus,
  TransferView,
} from '@ledgerflow/contracts';

export interface PrismaAccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  balanceMinor: bigint;
}

export interface PrismaTransferRow {
  id: string;
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: bigint;
  currency: string;
  reference: string;
  status: string;
  journalId: string;
  createdAt: Date;
  settledAt: Date | null;
  reversedAt: Date | null;
}

export interface PrismaJournalRow {
  id: string;
  transferId: string;
  currency: string;
  reference: string;
  reversalOfJournalId: string | null;
  createdAt: Date;
  postings: Array<{
    id: string;
    accountId: string;
    side: string;
    amountMinor: bigint;
    account: { code: string; name: string };
  }>;
}

export interface PrismaSettlementRow {
  id: string;
  transferId: string;
  eventId: string;
  status: string;
  attemptCount: number;
  createdAt: Date;
  completedAt: Date | null;
}

export function toSafeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Database amount exceeds the JavaScript safe integer range');
  }
  return result;
}

export function mapAccount(row: PrismaAccountRow): AccountView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: assertAccountType(row.type),
    currency: assertCurrency(row.currency),
    balanceMinor: toSafeNumber(row.balanceMinor),
  };
}

export function mapTransfer(row: PrismaTransferRow): TransferView {
  const transfer: TransferView = {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    sourceAccountId: row.sourceAccountId,
    destinationAccountId: row.destinationAccountId,
    amountMinor: toSafeNumber(row.amountMinor),
    currency: assertCurrency(row.currency),
    reference: row.reference,
    status: assertTransferStatus(row.status),
    journalId: row.journalId,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.settledAt) transfer.settledAt = row.settledAt.toISOString();
  if (row.reversedAt) transfer.reversedAt = row.reversedAt.toISOString();
  return transfer;
}

export function mapJournal(row: PrismaJournalRow): JournalView {
  const journal: JournalView = {
    id: row.id,
    transferId: row.transferId,
    currency: assertCurrency(row.currency),
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    postings: row.postings.map((posting) => ({
      id: posting.id,
      accountId: posting.accountId,
      accountCode: posting.account.code,
      accountName: posting.account.name,
      side: assertPostingSide(posting.side),
      amountMinor: toSafeNumber(posting.amountMinor),
    })),
  };
  if (row.reversalOfJournalId) journal.reversalOfJournalId = row.reversalOfJournalId;
  return journal;
}

export function mapSettlement(row: PrismaSettlementRow): SettlementView {
  const settlement: SettlementView = {
    id: row.id,
    transferId: row.transferId,
    eventId: row.eventId,
    status: assertSettlementStatus(row.status),
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.completedAt) settlement.completedAt = row.completedAt.toISOString();
  return settlement;
}

function assertCurrency(value: string): Currency {
  if (value !== 'USD') throw new Error(`Unsupported currency in database: ${value}`);
  return value;
}

function assertAccountType(value: string): AccountType {
  if (value !== 'ASSET' && value !== 'LIABILITY') {
    throw new Error(`Unsupported account type in database: ${value}`);
  }
  return value;
}

function assertTransferStatus(value: string): TransferStatus {
  if (value !== 'PENDING' && value !== 'SETTLED' && value !== 'REVERSED' && value !== 'FAILED') {
    throw new Error(`Unsupported transfer status in database: ${value}`);
  }
  return value;
}

function assertPostingSide(value: string): PostingSide {
  if (value !== 'DEBIT' && value !== 'CREDIT') {
    throw new Error(`Unsupported posting side in database: ${value}`);
  }
  return value;
}

function assertSettlementStatus(value: string): SettlementStatus {
  if (value !== 'PENDING' && value !== 'SETTLED' && value !== 'FAILED') {
    throw new Error(`Unsupported settlement status in database: ${value}`);
  }
  return value;
}
