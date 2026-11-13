import type {
  AccountType,
  AccountView,
  Currency,
  FxQuoteView,
  FxConversionView,
  JournalView,
  PostingSide,
  SettlementStatus,
  SettlementView,
  TransferStatus,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';

export interface PrismaAccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  balanceMinor: bigint;
}

export interface PrismaWalletRow {
  id: string;
  ownerName: string;
  balances: Array<{
    currency: string;
    account: { balanceMinor: bigint };
  }>;
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

export interface PrismaFxQuoteRow {
  id: string;
  provider: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmountMinor: bigint;
  destinationAmountMinor: bigint;
  rateDecimal: string;
  rateNumerator: bigint;
  rateDenominator: bigint;
  rateDate: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface PrismaFxConversionRow {
  id: string;
  idempotencyKey: string;
  quoteId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmountMinor: bigint;
  destinationAmountMinor: bigint;
  sourceCurrency: string;
  destinationCurrency: string;
  rateDecimal: string;
  journalId: string;
  reference: string;
  createdAt: Date;
}

export interface PrismaJournalRow {
  id: string;
  transferId: string | null;
  fundingId: string | null;
  fxConversionId: string | null;
  currency: string | null;
  reference: string;
  reversalOfJournalId: string | null;
  createdAt: Date;
  postings: Array<{
    id: string;
    accountId: string;
    side: string;
    amountMinor: bigint;
    currency: string;
    account: { code: string; name: string };
  }>;
}

export interface PrismaWalletFundingRow {
  id: string;
  idempotencyKey: string;
  fundingAccountId: string;
  walletAccountId: string;
  amountMinor: bigint;
  currency: string;
  reference: string;
  journalId: string;
  createdAt: Date;
  walletAccount: { name: string };
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

export function mapWallet(row: PrismaWalletRow): WalletView {
  return {
    id: row.id,
    ownerName: row.ownerName,
    balances: row.balances.map((balance) => ({
      currency: assertCurrency(balance.currency),
      balanceMinor: toSafeNumber(balance.account.balanceMinor),
    })),
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

export function mapFxQuote(row: PrismaFxQuoteRow): FxQuoteView {
  return {
    id: row.id,
    provider: row.provider,
    sourceCurrency: assertCurrency(row.sourceCurrency),
    destinationCurrency: assertCurrency(row.destinationCurrency),
    sourceAmountMinor: toSafeNumber(row.sourceAmountMinor),
    destinationAmountMinor: toSafeNumber(row.destinationAmountMinor),
    rateDecimal: row.rateDecimal,
    rateNumerator: row.rateNumerator.toString(),
    rateDenominator: row.rateDenominator.toString(),
    rateDate: row.rateDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function mapFxConversion(row: PrismaFxConversionRow): FxConversionView {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    quoteId: row.quoteId,
    sourceAccountId: row.sourceAccountId,
    destinationAccountId: row.destinationAccountId,
    sourceAmountMinor: toSafeNumber(row.sourceAmountMinor),
    destinationAmountMinor: toSafeNumber(row.destinationAmountMinor),
    sourceCurrency: assertCurrency(row.sourceCurrency),
    destinationCurrency: assertCurrency(row.destinationCurrency),
    rateDecimal: row.rateDecimal,
    journalId: row.journalId,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapJournal(row: PrismaJournalRow): JournalView {
  const journal: JournalView = {
    id: row.id,
    currencies: [...new Set(row.postings.map((posting) => assertCurrency(posting.currency)))],
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    postings: row.postings.map((posting) => ({
      id: posting.id,
      accountId: posting.accountId,
      accountCode: posting.account.code,
      accountName: posting.account.name,
      side: assertPostingSide(posting.side),
      amountMinor: toSafeNumber(posting.amountMinor),
      currency: assertCurrency(posting.currency),
    })),
  };
  if (row.currency) journal.currency = assertCurrency(row.currency);
  if (row.transferId) journal.transferId = row.transferId;
  if (row.fundingId) journal.fundingId = row.fundingId;
  if (row.fxConversionId) journal.fxConversionId = row.fxConversionId;
  if (row.reversalOfJournalId) journal.reversalOfJournalId = row.reversalOfJournalId;
  return journal;
}

export function mapWalletFunding(row: PrismaWalletFundingRow): WalletFundingView {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    fundingAccountId: row.fundingAccountId,
    walletAccountId: row.walletAccountId,
    walletName: row.walletAccount.name,
    amountMinor: toSafeNumber(row.amountMinor),
    currency: assertCurrency(row.currency),
    reference: row.reference,
    journalId: row.journalId,
    createdAt: row.createdAt.toISOString(),
  };
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
  if (value !== 'USD' && value !== 'EUR' && value !== 'GBP' && value !== 'EGP') {
    throw new Error(`Unsupported currency in database: ${value}`);
  }
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
