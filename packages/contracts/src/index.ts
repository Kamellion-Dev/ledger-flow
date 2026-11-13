export const LEDGER_PACKAGE = 'ledgerflow.ledger.v1';
export const LEDGER_SERVICE = 'LedgerService';

export const LedgerEventName = {
  TransferPosted: 'transfer.posted.v1',
  SettlementCompleted: 'settlement.completed.v1',
} as const;

export type LedgerEventName = (typeof LedgerEventName)[keyof typeof LedgerEventName];
export type Currency = 'USD' | 'EUR' | 'GBP' | 'EGP';
export type TransferStatus = 'PENDING' | 'SETTLED' | 'REVERSED' | 'FAILED';
export type SettlementStatus = 'PENDING' | 'SETTLED' | 'FAILED';
export type AccountType = 'ASSET' | 'LIABILITY';
export type PostingSide = 'DEBIT' | 'CREDIT';

export interface CreateTransferCommand {
  idempotencyKey: string;
  sourceWalletId: string;
  destinationWalletId: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
}

export interface ReverseTransferCommand {
  transferId: string;
  idempotencyKey: string;
  reason: string;
}

export interface CreateWalletFundingCommand {
  idempotencyKey: string;
  walletId: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
}

export interface CreateWalletBalanceCommand {
  walletId: string;
  currency: Currency;
}

export interface CreateFxQuoteCommand {
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  sourceAmountMinor: number;
}

export interface CreateFxConversionCommand {
  idempotencyKey: string;
  quoteId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  reference: string;
}

export interface AccountView {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balanceMinor: number;
}

export interface WalletBalanceView {
  currency: Currency;
  balanceMinor: number;
}

export interface WalletView {
  id: string;
  ownerName: string;
  balances: WalletBalanceView[];
}

export interface WalletListView {
  items: WalletView[];
}

export interface PostingView {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  side: PostingSide;
  amountMinor: number;
  currency: Currency;
}

export interface JournalView {
  id: string;
  transferId?: string;
  fundingId?: string;
  fxConversionId?: string;
  currency?: Currency;
  currencies: Currency[];
  reference: string;
  reversalOfJournalId?: string;
  createdAt: string;
  postings: PostingView[];
}

export interface FxQuoteView {
  id: string;
  provider: string;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  sourceAmountMinor: number;
  destinationAmountMinor: number;
  rateDecimal: string;
  rateNumerator: string;
  rateDenominator: string;
  rateDate: string;
  createdAt: string;
  expiresAt: string;
}

export interface FxConversionView {
  id: string;
  idempotencyKey: string;
  quoteId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmountMinor: number;
  destinationAmountMinor: number;
  sourceCurrency: Currency;
  destinationCurrency: Currency;
  rateDecimal: string;
  journalId: string;
  reference: string;
  createdAt: string;
}

export interface WalletFundingView {
  id: string;
  idempotencyKey: string;
  fundingAccountId: string;
  walletAccountId: string;
  walletName: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
  journalId: string;
  createdAt: string;
}

export interface TransferView {
  id: string;
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
  status: TransferStatus;
  journalId: string;
  createdAt: string;
  settledAt?: string;
  reversedAt?: string;
}

export interface SettlementView {
  id: string;
  transferId: string;
  eventId: string;
  status: SettlementStatus;
  attemptCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface DashboardSummary {
  totalVolumeMinor: number;
  settledVolumeMinor: number;
  pendingCount: number;
  settledCount: number;
  failedCount: number;
  accountCount: number;
  recentTransfers: TransferView[];
  volumeByHour: Array<{ hour: string; amountMinor: number }>;
  generatedAt: string;
}

export interface TransferPostedData {
  transferId: string;
  journalId: string;
  amountMinor: number;
  currency: Currency;
}

export interface SettlementCompletedData {
  transferId: string;
  settlementId: string;
  status: 'SETTLED' | 'FAILED';
  completedAt: string;
}

export interface LedgerEvent<TData = unknown> {
  eventId: string;
  eventName: LedgerEventName;
  occurredAt: string;
  correlationId: string;
  data: TData;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
