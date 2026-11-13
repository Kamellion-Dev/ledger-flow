import type {
  AccountView,
  Currency,
  FxConversionView,
  FxQuoteView,
  JournalView,
  LedgerEvent,
  SettlementView,
  TransferView,
  WalletView,
  WalletFundingView,
} from '@ledgerflow/contracts';

export interface IdempotencyRecord {
  readonly key: string;
  readonly operation:
    | 'CREATE_TRANSFER'
    | 'REVERSE_TRANSFER'
    | 'CREATE_WALLET_FUNDING'
    | 'CREATE_FX_CONVERSION';
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
  readonly walletFundings: WalletFundingView[];
  readonly fxQuotes: FxQuoteView[];
  readonly fxConversions: FxConversionView[];
  readonly idempotency: IdempotencyRecord[];
  readonly outbox: OutboxRecord[];
  readonly processedEventIds: string[];
  readonly wallets: WalletIdentity[];
  readonly walletBalances: WalletBalanceLink[];
}

export interface WalletIdentity {
  readonly id: string;
  readonly ownerName: string;
}

export interface WalletBalanceLink {
  readonly walletId: string;
  readonly currency: Currency;
  readonly accountId: string;
}

export interface CreateWalletBalanceRecord {
  readonly walletId: string;
  readonly currency: Currency;
  readonly account: AccountView;
}

export interface CreateWalletFundingAggregate {
  readonly funding: WalletFundingView;
  readonly journal: JournalView;
  readonly idempotency: IdempotencyRecord;
}

export interface CreateTransferAggregate {
  readonly transfer: TransferView;
  readonly journal: JournalView;
  readonly idempotency: IdempotencyRecord;
  readonly outbox: OutboxRecord;
}

export interface CreateFxConversionAggregate {
  readonly conversion: FxConversionView;
  readonly journal: JournalView;
  readonly idempotency: IdempotencyRecord;
  readonly sourceCashAccountId: string;
  readonly destinationCashAccountId: string;
}

export interface ReverseTransferAggregate {
  readonly transfer: TransferView;
  readonly journal: JournalView;
  readonly idempotency: IdempotencyRecord;
}

export interface LedgerUnitOfWork {
  lockIdempotencyKey(key: string): Promise<void>;
  findAccount(id: string): Promise<AccountView | undefined>;
  findWallet(id: string): Promise<WalletView | undefined>;
  findWalletBalanceAccount(walletId: string, currency: Currency): Promise<AccountView | undefined>;
  findTransfer(id: string): Promise<TransferView | undefined>;
  findWalletFunding(id: string): Promise<WalletFundingView | undefined>;
  findFxQuote(id: string): Promise<FxQuoteView | undefined>;
  findFxConversion(id: string): Promise<FxConversionView | undefined>;
  findPlatformCashAccount(currency: Currency): Promise<AccountView | undefined>;
  findJournal(id: string): Promise<JournalView | undefined>;
  findIdempotency(key: string): Promise<IdempotencyRecord | undefined>;
  createTransfer(aggregate: CreateTransferAggregate): Promise<void>;
  createWalletFunding(aggregate: CreateWalletFundingAggregate): Promise<void>;
  createFxConversion(aggregate: CreateFxConversionAggregate): Promise<void>;
  createWalletBalance(record: CreateWalletBalanceRecord): Promise<void>;
  reverseTransfer(aggregate: ReverseTransferAggregate): Promise<void>;
}

export interface LedgerRepository {
  transaction<T>(work: (unitOfWork: LedgerUnitOfWork) => Promise<T>): Promise<T>;
  createFxQuote(quote: FxQuoteView): Promise<void>;
  listAccounts(): Promise<AccountView[]>;
  listWallets(): Promise<WalletView[]>;
  listFxConversions(
    page: number,
    pageSize: number,
  ): Promise<{ items: FxConversionView[]; total: number }>;
  listTransfers(page: number, pageSize: number): Promise<{ items: TransferView[]; total: number }>;
  listWalletFundings(
    page: number,
    pageSize: number,
  ): Promise<{ items: WalletFundingView[]; total: number }>;
  listSettlements(
    page: number,
    pageSize: number,
  ): Promise<{ items: SettlementView[]; total: number }>;
  findJournal(id: string): Promise<JournalView | undefined>;
}
