import { randomUUID } from 'node:crypto';
import { Controller } from '@nestjs/common';
import {
  GrpcAlreadyExistsException,
  GrpcFailedPreconditionException,
  GrpcInternalException,
  GrpcInvalidArgumentException,
  GrpcMethod,
  GrpcNotFoundException,
  GrpcUnavailableException,
} from '@nestjs/microservices';
import type {
  CreateWalletBalanceCommand,
  CreateWalletFundingCommand,
  CreateFxConversionCommand,
  Currency,
  ReverseTransferCommand,
} from '@ledgerflow/contracts';
import {
  JournalValidationError,
  FxConversionValidationError,
  FxRateValidationError,
  MoneyValidationError,
  TransferValidationError,
  WalletFundingValidationError,
} from '@ledgerflow/ledger-domain';
import {
  IdempotencyConflictError,
  FxConversionStateError,
  FxQuoteValidationError,
  LedgerApplicationService,
  LedgerResourceNotFoundError,
  TransferStateError,
  WalletBalanceConflictError,
} from '../ledger/ledger-application.service.js';
import { ExchangeRateProviderError } from '../fx/exchange-rate.provider.js';

interface CreateTransferRequest {
  idempotencyKey: string;
  sourceWalletId: string;
  destinationWalletId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  correlationId?: string;
}

interface ReverseTransferRequest extends ReverseTransferCommand {
  correlationId?: string;
}

interface CreateWalletFundingRequest extends CreateWalletFundingCommand {
  correlationId?: string;
}

type CreateWalletBalanceRequest = CreateWalletBalanceCommand;

interface CreateFxQuoteRequest {
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmountMinor: number;
}

interface CreateFxConversionRequest extends CreateFxConversionCommand {
  correlationId?: string;
}

interface PageRequest {
  page?: number;
  pageSize?: number;
}

@Controller()
export class LedgerGrpcController {
  constructor(private readonly ledger: LedgerApplicationService) {}

  @GrpcMethod('LedgerService', 'CreateFxQuote')
  async createFxQuote(request: CreateFxQuoteRequest) {
    try {
      return await this.ledger.createFxQuote({
        sourceCurrency: request.sourceCurrency as Currency,
        destinationCurrency: request.destinationCurrency as Currency,
        sourceAmountMinor: request.sourceAmountMinor,
      });
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  @GrpcMethod('LedgerService', 'CreateFxConversion')
  async createFxConversion(request: CreateFxConversionRequest) {
    try {
      return await this.ledger.createFxConversion(
        {
          idempotencyKey: request.idempotencyKey,
          quoteId: request.quoteId,
          sourceAccountId: request.sourceAccountId,
          destinationAccountId: request.destinationAccountId,
          reference: request.reference,
        },
        request.correlationId ?? randomUUID(),
      );
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  @GrpcMethod('LedgerService', 'ListFxConversions')
  listFxConversions(request: PageRequest) {
    return this.ledger.listFxConversions(request.page ?? 1, request.pageSize ?? 25);
  }

  @GrpcMethod('LedgerService', 'CreateWalletFunding')
  async createWalletFunding(request: CreateWalletFundingRequest) {
    try {
      return await this.ledger.createWalletFunding(
        {
          idempotencyKey: request.idempotencyKey,
          walletId: request.walletId,
          amountMinor: request.amountMinor,
          currency: request.currency,
          reference: request.reference,
        },
        request.correlationId ?? randomUUID(),
      );
    } catch (error) {
      throw mapGrpcError(error);
    }
  }

  @GrpcMethod('LedgerService', 'ListWalletFundings')
  listWalletFundings(request: PageRequest) {
    return this.ledger.listWalletFundings(request.page ?? 1, request.pageSize ?? 25);
  }

  @GrpcMethod('LedgerService', 'CreateTransfer')
  async createTransfer(request: CreateTransferRequest) {
    try {
      return await this.ledger.createTransfer(
        {
          idempotencyKey: request.idempotencyKey,
          sourceWalletId: request.sourceWalletId,
          destinationWalletId: request.destinationWalletId,
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

  @GrpcMethod('LedgerService', 'ListWallets')
  async listWallets() {
    return { items: await this.ledger.listWallets() };
  }

  @GrpcMethod('LedgerService', 'CreateWalletBalance')
  async createWalletBalance(request: CreateWalletBalanceRequest) {
    try {
      return await this.ledger.createWalletBalance({
        walletId: request.walletId,
        currency: request.currency,
      });
    } catch (error) {
      throw mapGrpcError(error);
    }
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
  if (error instanceof ExchangeRateProviderError) {
    return new GrpcUnavailableException(error.message);
  }
  if (error instanceof IdempotencyConflictError) {
    return new GrpcAlreadyExistsException(error.message);
  }
  if (error instanceof WalletBalanceConflictError) {
    return new GrpcAlreadyExistsException(error.message);
  }
  if (error instanceof LedgerResourceNotFoundError) {
    return new GrpcNotFoundException(error.message);
  }
  if (
    error instanceof TransferStateError ||
    error instanceof FxConversionStateError ||
    error instanceof FxQuoteValidationError
  ) {
    return new GrpcFailedPreconditionException(error.message);
  }
  if (
    error instanceof MoneyValidationError ||
    error instanceof JournalValidationError ||
    error instanceof TransferValidationError ||
    error instanceof WalletFundingValidationError ||
    error instanceof FxConversionValidationError ||
    error instanceof FxRateValidationError
  ) {
    return new GrpcInvalidArgumentException(error.message);
  }
  return new GrpcInternalException('Ledger operation failed');
}
