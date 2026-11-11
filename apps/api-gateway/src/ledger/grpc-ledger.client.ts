import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable } from 'rxjs';
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
import type { LedgerPort } from './ledger.port.js';

export const LEDGER_GRPC_CLIENT = Symbol('LEDGER_GRPC_CLIENT');

interface LedgerGrpcService {
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
