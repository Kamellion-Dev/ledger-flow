import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable } from 'rxjs';
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
import type { LedgerPort } from './ledger.port.js';

export const LEDGER_GRPC_CLIENT = Symbol('LEDGER_GRPC_CLIENT');

interface LedgerGrpcService {
  listWallets(request: Record<string, never>): Observable<{ items: WalletView[] }>;
  createWalletBalance(request: CreateWalletBalanceCommand): Observable<WalletView>;
  createFxQuote(request: CreateFxQuoteCommand): Observable<FxQuoteView>;
  createFxConversion(
    request: CreateFxConversionCommand & { correlationId?: string },
  ): Observable<FxConversionView>;
  listFxConversions(request: {
    page: number;
    pageSize: number;
  }): Observable<Page<FxConversionView>>;
  createWalletFunding(
    request: CreateWalletFundingCommand & { correlationId?: string },
  ): Observable<WalletFundingView>;
  listWalletFundings(request: {
    page: number;
    pageSize: number;
  }): Observable<Page<WalletFundingView>>;
  createTransfer(
    request: CreateTransferCommand & { correlationId?: string },
  ): Observable<TransferView>;
  reverseTransfer(
    request: ReverseTransferCommand & { correlationId?: string },
  ): Observable<TransferView>;
  listTransfers(request: { page: number; pageSize: number }): Observable<Page<TransferView>>;
  listAccounts(request: Record<string, never>): Observable<{ items: AccountView[] }>;
  listSettlements(request: { page: number; pageSize: number }): Observable<Page<SettlementView>>;
  getJournal(request: { id: string }): Observable<JournalView>;
  getSummary(request: Record<string, never>): Observable<DashboardSummary>;
  health(request: Record<string, never>): Observable<{ status: string }>;
}

@Injectable()
export class GrpcLedgerClient implements LedgerPort, OnModuleInit {
  private service?: LedgerGrpcService;

  constructor(@Inject(LEDGER_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.service = this.client.getService<LedgerGrpcService>('LedgerService');
  }

  async listWallets(): Promise<WalletView[]> {
    return (await firstValueFrom(this.getService().listWallets({}))).items;
  }

  createWalletBalance(command: CreateWalletBalanceCommand): Promise<WalletView> {
    return firstValueFrom(this.getService().createWalletBalance(command));
  }

  createFxQuote(command: CreateFxQuoteCommand): Promise<FxQuoteView> {
    return firstValueFrom(this.getService().createFxQuote(command));
  }

  createFxConversion(
    command: CreateFxConversionCommand,
    correlationId?: string,
  ): Promise<FxConversionView> {
    return firstValueFrom(
      this.getService().createFxConversion({
        ...command,
        ...(correlationId ? { correlationId } : {}),
      }),
    );
  }

  listFxConversions(page: number, pageSize: number): Promise<Page<FxConversionView>> {
    return firstValueFrom(this.getService().listFxConversions({ page, pageSize }));
  }

  createWalletFunding(
    command: CreateWalletFundingCommand,
    correlationId?: string,
  ): Promise<WalletFundingView> {
    return firstValueFrom(
      this.getService().createWalletFunding({
        ...command,
        ...(correlationId ? { correlationId } : {}),
      }),
    );
  }

  listWalletFundings(page: number, pageSize: number): Promise<Page<WalletFundingView>> {
    return firstValueFrom(this.getService().listWalletFundings({ page, pageSize }));
  }

  createTransfer(command: CreateTransferCommand, correlationId?: string): Promise<TransferView> {
    return firstValueFrom(
      this.getService().createTransfer({
        ...command,
        ...(correlationId ? { correlationId } : {}),
      }),
    );
  }

  reverseTransfer(command: ReverseTransferCommand, correlationId?: string): Promise<TransferView> {
    return firstValueFrom(
      this.getService().reverseTransfer({
        ...command,
        ...(correlationId ? { correlationId } : {}),
      }),
    );
  }

  listTransfers(page: number, pageSize: number): Promise<Page<TransferView>> {
    return firstValueFrom(this.getService().listTransfers({ page, pageSize }));
  }

  async listAccounts(): Promise<AccountView[]> {
    return (await firstValueFrom(this.getService().listAccounts({}))).items;
  }

  listSettlements(page: number, pageSize: number): Promise<Page<SettlementView>> {
    return firstValueFrom(this.getService().listSettlements({ page, pageSize }));
  }

  getJournal(id: string): Promise<JournalView> {
    return firstValueFrom(this.getService().getJournal({ id }));
  }

  getSummary(): Promise<DashboardSummary> {
    return firstValueFrom(this.getService().getSummary({}));
  }

  health(): Promise<{ status: string }> {
    return firstValueFrom(this.getService().health({}));
  }

  private getService(): LedgerGrpcService {
    if (!this.service) throw new Error('Ledger gRPC client is not initialized');
    return this.service;
  }
}
