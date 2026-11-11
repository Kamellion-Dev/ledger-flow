import { randomUUID } from 'node:crypto';
import { Controller } from '@nestjs/common';
import {
  GrpcAlreadyExistsException,
  GrpcFailedPreconditionException,
  GrpcInternalException,
  GrpcInvalidArgumentException,
  GrpcMethod,
  GrpcNotFoundException,
} from '@nestjs/microservices';
import type { Currency, ReverseTransferCommand } from '@ledgerflow/contracts';
import {
  JournalValidationError,
  MoneyValidationError,
  TransferValidationError,
} from '@ledgerflow/ledger-domain';
import {
  IdempotencyConflictError,
  LedgerApplicationService,
  LedgerResourceNotFoundError,
  TransferStateError,
} from '../ledger/ledger-application.service.js';

interface CreateTransferRequest {
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  correlationId?: string;
}

interface ReverseTransferRequest extends ReverseTransferCommand {
  correlationId?: string;
}

interface PageRequest {
  page?: number;
  pageSize?: number;
}

@Controller()
export class LedgerGrpcController {
  constructor(private readonly ledger: LedgerApplicationService) {}

  @GrpcMethod('LedgerService', 'CreateTransfer')
  async createTransfer(request: CreateTransferRequest) {
    try {
      return await this.ledger.createTransfer(
        {
          idempotencyKey: request.idempotencyKey,
          sourceAccountId: request.sourceAccountId,
          destinationAccountId: request.destinationAccountId,
          amountMinor: request.amountMinor,
          currency: request.currency as Currency,
          reference: request.reference,
        },
        request.correlationId ?? randomUUID(),
      );
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  @GrpcMethod('LedgerService', 'ReverseTransfer')
  async reverseTransfer(request: ReverseTransferRequest) {
    try {
      return await this.ledger.reverseTransfer(
        {
          transferId: request.transferId,
          idempotencyKey: request.idempotencyKey,
          reason: request.reason,
        },
        request.correlationId ?? randomUUID(),
      );
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  @GrpcMethod('LedgerService', 'ListTransfers')
  listTransfers(request: PageRequest) {
    return this.ledger.listTransfers(request.page ?? 1, request.pageSize ?? 25);
  }

  @GrpcMethod('LedgerService', 'ListAccounts')
  async listAccounts() {
    return { items: await this.ledger.listAccounts() };
  }

  @GrpcMethod('LedgerService', 'ListSettlements')
  listSettlements(request: PageRequest) {
    return this.ledger.listSettlements(request.page ?? 1, request.pageSize ?? 25);
  }

  @GrpcMethod('LedgerService', 'GetJournal')
  async getJournal(request: { id: string }) {
    try {
      return await this.ledger.getJournal(request.id);
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  @GrpcMethod('LedgerService', 'GetSummary')
  getSummary() {
    return this.ledger.getSummary();
  }

  @GrpcMethod('LedgerService', 'Health')
  health() {
    return { status: 'ok' };
  }
}

function mapGrpcError(error: unknown): Error {
  if (error instanceof IdempotencyConflictError) {
    return new GrpcAlreadyExistsException(error.message);
  }
  if (error instanceof LedgerResourceNotFoundError) {
    return new GrpcNotFoundException(error.message);
  }
  if (error instanceof TransferStateError) {
    return new GrpcFailedPreconditionException(error.message);
  }
  if (
    error instanceof MoneyValidationError ||
    error instanceof JournalValidationError ||
    error instanceof TransferValidationError
  ) {
    return new GrpcInvalidArgumentException(error.message);
  }
  return new GrpcInternalException('Ledger operation failed');
}
