import type {
  AccountView,
  CreateTransferCommand,
  DashboardSummary,
  JournalView,
  Page,
  ReverseTransferCommand,
  SettlementView,
  TransferView,
} from '@ledgerflow/contracts';

export const LEDGER_PORT = Symbol('LEDGER_PORT');

export interface LedgerPort {
  createTransfer(command: CreateTransferCommand, correlationId?: string): Promise<TransferView>;
  reverseTransfer(command: ReverseTransferCommand, correlationId?: string): Promise<TransferView>;
  listTransfers(page: number, pageSize: number): Promise<Page<TransferView>>;
  listAccounts(): Promise<AccountView[]>;
  listSettlements(page: number, pageSize: number): Promise<Page<SettlementView>>;
  getJournal(id: string): Promise<JournalView>;
  getSummary(): Promise<DashboardSummary>;
  health(): Promise<{ status: string }>;
}
