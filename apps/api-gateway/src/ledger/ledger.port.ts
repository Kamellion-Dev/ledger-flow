import type {
  AccountView,
  CreateFxConversionCommand,
  CreateFxQuoteCommand,
  CreateWalletBalanceCommand,
  CreateTransferCommand,
  CreateWalletFundingCommand,
  DashboardSummary,
  FxConversionView,
  FxQuoteView,
  JournalView,
  Page,
  ReverseTransferCommand,
  SettlementView,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';

export const LEDGER_PORT = Symbol('LEDGER_PORT');

export interface LedgerPort {
  listWallets(): Promise<WalletView[]>;
  createWalletBalance(command: CreateWalletBalanceCommand): Promise<WalletView>;
  createFxQuote(command: CreateFxQuoteCommand): Promise<FxQuoteView>;
  createFxConversion(
    command: CreateFxConversionCommand,
    correlationId?: string,
  ): Promise<FxConversionView>;
  listFxConversions(page: number, pageSize: number): Promise<Page<FxConversionView>>;
  createWalletFunding(
    command: CreateWalletFundingCommand,
    correlationId?: string,
  ): Promise<WalletFundingView>;
  listWalletFundings(page: number, pageSize: number): Promise<Page<WalletFundingView>>;
  createTransfer(command: CreateTransferCommand, correlationId?: string): Promise<TransferView>;
  reverseTransfer(command: ReverseTransferCommand, correlationId?: string): Promise<TransferView>;
  listTransfers(page: number, pageSize: number): Promise<Page<TransferView>>;
  listAccounts(): Promise<AccountView[]>;
  listSettlements(page: number, pageSize: number): Promise<Page<SettlementView>>;
  getJournal(id: string): Promise<JournalView>;
  getSummary(): Promise<DashboardSummary>;
  health(): Promise<{ status: string }>;
}
