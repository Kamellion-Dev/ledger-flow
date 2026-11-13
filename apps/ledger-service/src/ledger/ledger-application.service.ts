import { createHash } from 'node:crypto';
import type {
  AccountView,
  CreateFxQuoteCommand,
  CreateFxConversionCommand,
  CreateTransferCommand,
  CreateWalletBalanceCommand,
  CreateWalletFundingCommand,
  DashboardSummary,
  FxQuoteView,
  FxConversionView,
  JournalView,
  LedgerEvent,
  Page,
  ReverseTransferCommand,
  SettlementView,
  TransferPostedData,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';
import { LedgerEventName } from '@ledgerflow/contracts';
import {
  buildTransferJournal,
  TransferValidationError,
  buildWalletFundingJournal,
  buildFxConversionJournal,
  convertMinorUnits,
  parseDecimalRatio,
} from '@ledgerflow/ledger-domain';
import {
  ExchangeRateProviderError,
  type ExchangeRateProvider,
} from '../fx/exchange-rate.provider.js';
import type {
  CreateTransferAggregate,
  CreateFxConversionAggregate,
  CreateWalletFundingAggregate,
  IdempotencyRecord,
  LedgerRepository,
  OutboxRecord,
  ReverseTransferAggregate,
} from './ledger-repository.js';

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used with a different payload');
    this.name = 'IdempotencyConflictError';
  }
}

export class LedgerResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found`);
    this.name = 'LedgerResourceNotFoundError';
  }
}

export class TransferStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferStateError';
  }
}

export class FxQuoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxQuoteValidationError';
  }
}

export class FxConversionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxConversionStateError';
  }
}

export class WalletBalanceConflictError extends Error {
  constructor(currency: string) {
    super(`Wallet already has a ${currency} balance`);
    this.name = 'WalletBalanceConflictError';
  }
}

const unavailableExchangeRateProvider: ExchangeRateProvider = {
  getRate: () =>
    Promise.reject(new ExchangeRateProviderError('Exchange-rate provider is not configured')),
};

export interface LedgerRuntime {
  nextId(): string;
  now(): Date;
}

export class LedgerApplicationService {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly runtime: LedgerRuntime,
    private readonly exchangeRateProvider: ExchangeRateProvider = unavailableExchangeRateProvider,
  ) {}

  async createWalletBalance(command: CreateWalletBalanceCommand): Promise<WalletView> {
    return this.repository.transaction(async (unitOfWork) => {
      const wallet = await unitOfWork.findWallet(command.walletId);
      if (!wallet) throw new LedgerResourceNotFoundError('Wallet');
      if (wallet.balances.some((balance) => balance.currency === command.currency)) {
        throw new WalletBalanceConflictError(command.currency);
      }
      const account: AccountView = {
        id: this.runtime.nextId(),
        code: `2100-${wallet.id.toUpperCase()}-${command.currency}`,
        name: `${wallet.ownerName} ${command.currency} Balance`,
        type: 'LIABILITY',
        currency: command.currency,
        balanceMinor: 0,
      };
      await unitOfWork.createWalletBalance({
        walletId: wallet.id,
        currency: command.currency,
        account,
      });
      return {
        ...wallet,
        balances: [...wallet.balances, { currency: command.currency, balanceMinor: 0 }],
      };
    });
  }

  async createFxQuote(command: CreateFxQuoteCommand): Promise<FxQuoteView> {
    if (command.sourceCurrency === command.destinationCurrency) {
      throw new FxQuoteValidationError('FX quote requires two different currencies');
    }
    const providerRate = await this.exchangeRateProvider.getRate(
      command.sourceCurrency,
      command.destinationCurrency,
    );
    if (
      providerRate.base !== command.sourceCurrency ||
      providerRate.quote !== command.destinationCurrency
    ) {
      throw new FxQuoteValidationError('Provider rate does not match the requested currency pair');
    }
    const ratio = parseDecimalRatio(providerRate.decimal);
    const destinationAmountMinor = convertMinorUnits(
      command.sourceAmountMinor,
      ratio.numerator,
      ratio.denominator,
    );
    if (destinationAmountMinor <= 0) {
      throw new FxQuoteValidationError('Converted amount must be at least one minor unit');
    }
    const createdAt = this.runtime.now();
    const quote: FxQuoteView = {
      id: this.runtime.nextId(),
      provider: providerRate.provider,
      sourceCurrency: command.sourceCurrency,
      destinationCurrency: command.destinationCurrency,
      sourceAmountMinor: command.sourceAmountMinor,
      destinationAmountMinor,
      rateDecimal: ratio.decimal,
      rateNumerator: ratio.numerator.toString(),
      rateDenominator: ratio.denominator.toString(),
      rateDate: providerRate.effectiveDate,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 15 * 60 * 1_000).toISOString(),
    };
    await this.repository.createFxQuote(quote);
    return quote;
  }

  async createFxConversion(
    command: CreateFxConversionCommand,
    _correlationId: string,
  ): Promise<FxConversionView> {
    const requestHash = hashRequest({
      operation: 'CREATE_FX_CONVERSION',
      quoteId: command.quoteId,
      sourceAccountId: command.sourceAccountId,
      destinationAccountId: command.destinationAccountId,
      reference: command.reference.trim(),
    });

    return this.repository.transaction(async (unitOfWork) => {
      await unitOfWork.lockIdempotencyKey(command.idempotencyKey);
      const replay = await unitOfWork.findIdempotency(command.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.operation !== 'CREATE_FX_CONVERSION') {
          throw new IdempotencyConflictError();
        }
        const original = await unitOfWork.findFxConversion(replay.resourceId);
        if (!original) throw new LedgerResourceNotFoundError('Idempotent FX conversion result');
        return original;
      }

      const quote = await unitOfWork.findFxQuote(command.quoteId);
      if (!quote) throw new LedgerResourceNotFoundError('FX quote');
      const createdAt = this.runtime.now();
      if (createdAt.getTime() >= new Date(quote.expiresAt).getTime()) {
        throw new FxQuoteValidationError('FX quote has expired');
      }
      const [sourceWallet, destinationWallet, sourceCash, destinationCash] = await Promise.all([
        unitOfWork.findAccount(command.sourceAccountId),
        unitOfWork.findAccount(command.destinationAccountId),
        unitOfWork.findPlatformCashAccount(quote.sourceCurrency),
        unitOfWork.findPlatformCashAccount(quote.destinationCurrency),
      ]);
      if (!sourceWallet || !destinationWallet || !sourceCash || !destinationCash) {
        throw new LedgerResourceNotFoundError('FX conversion account');
      }
      const draft = buildFxConversionJournal(command, quote, {
        sourceWallet,
        destinationWallet,
        sourceCash,
        destinationCash,
      });
      const conversionId = this.runtime.nextId();
      const journalId = this.runtime.nextId();
      const timestamp = createdAt.toISOString();
      const conversion: FxConversionView = {
        id: conversionId,
        idempotencyKey: command.idempotencyKey,
        quoteId: quote.id,
        sourceAccountId: sourceWallet.id,
        destinationAccountId: destinationWallet.id,
        sourceAmountMinor: quote.sourceAmountMinor,
        destinationAmountMinor: quote.destinationAmountMinor,
        sourceCurrency: quote.sourceCurrency,
        destinationCurrency: quote.destinationCurrency,
        rateDecimal: quote.rateDecimal,
        journalId,
        reference: draft.reference,
        createdAt: timestamp,
      };
      const accounts = [sourceWallet, sourceCash, destinationCash, destinationWallet];
      const journal: JournalView = {
        id: journalId,
        fxConversionId: conversionId,
        currencies: [...draft.currencies],
        reference: draft.reference,
        createdAt: timestamp,
        postings: draft.postings.map((posting) => {
          const account = accounts.find((candidate) => candidate.id === posting.accountId);
          if (!account) throw new LedgerResourceNotFoundError('FX posting account');
          return {
            id: this.runtime.nextId(),
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            side: posting.side,
            amountMinor: posting.amountMinor,
            currency: posting.currency,
          };
        }),
      };
      const idempotency: IdempotencyRecord = {
        key: command.idempotencyKey,
        operation: 'CREATE_FX_CONVERSION',
        requestHash,
        resourceId: conversionId,
        createdAt: timestamp,
      };
      const aggregate: CreateFxConversionAggregate = {
        conversion,
        journal,
        idempotency,
        sourceCashAccountId: sourceCash.id,
        destinationCashAccountId: destinationCash.id,
      };
      await unitOfWork.createFxConversion(aggregate);
      return conversion;
    });
  }

  async createWalletFunding(
    command: CreateWalletFundingCommand,
    _correlationId: string,
  ): Promise<WalletFundingView> {
    const requestHash = hashRequest({
      operation: 'CREATE_WALLET_FUNDING',
      walletId: command.walletId,
      amountMinor: command.amountMinor,
      currency: command.currency,
      reference: command.reference.trim(),
    });

    return this.repository.transaction(async (unitOfWork) => {
      await unitOfWork.lockIdempotencyKey(command.idempotencyKey);
      const replay = await unitOfWork.findIdempotency(command.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.operation !== 'CREATE_WALLET_FUNDING') {
          throw new IdempotencyConflictError();
        }
        const original = await unitOfWork.findWalletFunding(replay.resourceId);
        if (!original) throw new LedgerResourceNotFoundError('Idempotent wallet funding result');
        return original;
      }

      const fundingAccount = await unitOfWork.findPlatformCashAccount(command.currency);
      if (!fundingAccount) {
        throw new LedgerResourceNotFoundError(`Platform cash ${command.currency} account`);
      }
      const walletAccount = await unitOfWork.findWalletBalanceAccount(
        command.walletId,
        command.currency,
      );
      if (!walletAccount) {
        throw new LedgerResourceNotFoundError(`Wallet ${command.currency} balance`);
      }
      const draft = buildWalletFundingJournal(command, { fundingAccount, walletAccount });
      const createdAt = this.runtime.now().toISOString();
      const fundingId = this.runtime.nextId();
      const journalId = this.runtime.nextId();
      const funding: WalletFundingView = {
        id: fundingId,
        idempotencyKey: command.idempotencyKey,
        fundingAccountId: fundingAccount.id,
        walletAccountId: walletAccount.id,
        walletName: walletAccount.name,
        amountMinor: command.amountMinor,
        currency: command.currency,
        reference: draft.reference,
        journalId,
        createdAt,
      };
      const journal: JournalView = {
        id: journalId,
        fundingId,
        currency: draft.currency,
        currencies: [draft.currency],
        reference: draft.reference,
        createdAt,
        postings: draft.postings.map((posting) => {
          const account = posting.accountId === fundingAccount.id ? fundingAccount : walletAccount;
          return {
            id: this.runtime.nextId(),
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            side: posting.side,
            amountMinor: posting.amountMinor,
            currency: draft.currency,
          };
        }),
      };
      const idempotency: IdempotencyRecord = {
        key: command.idempotencyKey,
        operation: 'CREATE_WALLET_FUNDING',
        requestHash,
        resourceId: fundingId,
        createdAt,
      };
      const aggregate: CreateWalletFundingAggregate = { funding, journal, idempotency };
      await unitOfWork.createWalletFunding(aggregate);
      return funding;
    });
  }

  async createTransfer(
    command: CreateTransferCommand,
    correlationId: string,
  ): Promise<TransferView> {
    const requestHash = hashRequest({
      operation: 'CREATE_TRANSFER',
      sourceWalletId: command.sourceWalletId,
      destinationWalletId: command.destinationWalletId,
      amountMinor: command.amountMinor,
      currency: command.currency,
      reference: command.reference.trim(),
    });

    return this.repository.transaction(async (unitOfWork) => {
      await unitOfWork.lockIdempotencyKey(command.idempotencyKey);
      const replay = await unitOfWork.findIdempotency(command.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.operation !== 'CREATE_TRANSFER') {
          throw new IdempotencyConflictError();
        }
        const original = await unitOfWork.findTransfer(replay.resourceId);
        if (!original) {
          throw new LedgerResourceNotFoundError('Idempotent transfer result');
        }
        return original;
      }

      if (command.sourceWalletId === command.destinationWalletId) {
        throw new TransferValidationError('Transfers require two different customer accounts');
      }
      const source = await unitOfWork.findWalletBalanceAccount(
        command.sourceWalletId,
        command.currency,
      );
      if (!source) {
        throw new LedgerResourceNotFoundError(`Source wallet ${command.currency} balance`);
      }
      const destination = await unitOfWork.findWalletBalanceAccount(
        command.destinationWalletId,
        command.currency,
      );
      if (!destination) {
        throw new LedgerResourceNotFoundError(`Destination wallet ${command.currency} balance`);
      }

      const draft = buildTransferJournal(command, { source, destination });
      const createdAt = this.runtime.now().toISOString();
      const transferId = this.runtime.nextId();
      const journalId = this.runtime.nextId();
      const transfer: TransferView = {
        id: transferId,
        idempotencyKey: command.idempotencyKey,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amountMinor: command.amountMinor,
        currency: command.currency,
        reference: draft.reference,
        status: 'PENDING',
        journalId,
        createdAt,
      };
      const journal: JournalView = {
        id: journalId,
        transferId,
        currency: draft.currency,
        currencies: [draft.currency],
        reference: draft.reference,
        createdAt,
        postings: draft.postings.map((posting) => {
          const account = posting.accountId === source.id ? source : destination;
          return {
            id: this.runtime.nextId(),
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            side: posting.side,
            amountMinor: posting.amountMinor,
            currency: draft.currency,
          };
        }),
      };
      const eventId = this.runtime.nextId();
      const event: LedgerEvent<TransferPostedData> = {
        eventId,
        eventName: LedgerEventName.TransferPosted,
        occurredAt: createdAt,
        correlationId,
        data: {
          transferId,
          journalId,
          amountMinor: command.amountMinor,
          currency: command.currency,
        },
      };
      const idempotency: IdempotencyRecord = {
        key: command.idempotencyKey,
        operation: 'CREATE_TRANSFER',
        requestHash,
        resourceId: transferId,
        createdAt,
      };
      const outbox: OutboxRecord = {
        id: eventId,
        eventName: event.eventName,
        correlationId,
        event,
        status: 'PENDING',
        attemptCount: 0,
        createdAt,
      };
      const aggregate: CreateTransferAggregate = {
        transfer,
        journal,
        idempotency,
        outbox,
      };

      await unitOfWork.createTransfer(aggregate);
      return transfer;
    });
  }

  async reverseTransfer(
    command: ReverseTransferCommand,
    _correlationId: string,
  ): Promise<TransferView> {
    const requestHash = hashRequest({
      operation: 'REVERSE_TRANSFER',
      transferId: command.transferId,
      reason: command.reason.trim(),
    });

    return this.repository.transaction(async (unitOfWork) => {
      await unitOfWork.lockIdempotencyKey(command.idempotencyKey);
      const replay = await unitOfWork.findIdempotency(command.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.operation !== 'REVERSE_TRANSFER') {
          throw new IdempotencyConflictError();
        }
        const original = await unitOfWork.findTransfer(replay.resourceId);
        if (!original) {
          throw new LedgerResourceNotFoundError('Idempotent reversal result');
        }
        return original;
      }

      const transfer = await unitOfWork.findTransfer(command.transferId);
      if (!transfer) {
        throw new LedgerResourceNotFoundError('Transfer');
      }
      if (transfer.status === 'REVERSED') {
        throw new TransferStateError('Transfer is already reversed');
      }
      if (transfer.status === 'FAILED') {
        throw new TransferStateError('A failed transfer cannot be reversed');
      }
      const originalJournal = await unitOfWork.findJournal(transfer.journalId);
      const source = await unitOfWork.findAccount(transfer.sourceAccountId);
      const destination = await unitOfWork.findAccount(transfer.destinationAccountId);
      if (!originalJournal || !source || !destination) {
        throw new LedgerResourceNotFoundError('Transfer ledger data');
      }

      const reversedAt = this.runtime.now().toISOString();
      const updatedTransfer: TransferView = { ...transfer, status: 'REVERSED', reversedAt };
      const journal: JournalView = {
        id: this.runtime.nextId(),
        transferId: transfer.id,
        currency: transfer.currency,
        currencies: [transfer.currency],
        reference: `Reversal: ${command.reason.trim()}`,
        reversalOfJournalId: originalJournal.id,
        createdAt: reversedAt,
        postings: originalJournal.postings.map((posting) => ({
          ...posting,
          id: this.runtime.nextId(),
          side: posting.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        })),
      };
      const idempotency: IdempotencyRecord = {
        key: command.idempotencyKey,
        operation: 'REVERSE_TRANSFER',
        requestHash,
        resourceId: transfer.id,
        createdAt: reversedAt,
      };
      const aggregate: ReverseTransferAggregate = {
        transfer: updatedTransfer,
        journal,
        idempotency,
      };

      await unitOfWork.reverseTransfer(aggregate);
      return updatedTransfer;
    });
  }

  listAccounts(): Promise<AccountView[]> {
    return this.repository.listAccounts();
  }

  listWallets(): Promise<WalletView[]> {
    return this.repository.listWallets();
  }

  async listFxConversions(page: number, pageSize: number): Promise<Page<FxConversionView>> {
    const result = await this.repository.listFxConversions(page, pageSize);
    return { ...result, page, pageSize };
  }

  async listTransfers(page: number, pageSize: number): Promise<Page<TransferView>> {
    const result = await this.repository.listTransfers(page, pageSize);
    return { ...result, page, pageSize };
  }

  async listWalletFundings(page: number, pageSize: number): Promise<Page<WalletFundingView>> {
    const result = await this.repository.listWalletFundings(page, pageSize);
    return { ...result, page, pageSize };
  }

  async listSettlements(page: number, pageSize: number): Promise<Page<SettlementView>> {
    const result = await this.repository.listSettlements(page, pageSize);
    return { ...result, page, pageSize };
  }

  async getJournal(id: string): Promise<JournalView> {
    const journal = await this.repository.findJournal(id);
    if (!journal) throw new LedgerResourceNotFoundError('Journal');
    return journal;
  }

  async getSummary(): Promise<DashboardSummary> {
    const [{ items: transfers }, accounts] = await Promise.all([
      this.repository.listTransfers(1, 1_000),
      this.repository.listAccounts(),
    ]);
    const byHour = new Map<string, number>();
    for (const transfer of transfers) {
      const date = new Date(transfer.createdAt);
      date.setUTCMinutes(0, 0, 0);
      const hour = date.toISOString();
      byHour.set(hour, (byHour.get(hour) ?? 0) + transfer.amountMinor);
    }

    return {
      totalVolumeMinor: transfers.reduce((total, transfer) => total + transfer.amountMinor, 0),
      settledVolumeMinor: transfers
        .filter((transfer) => transfer.status === 'SETTLED')
        .reduce((total, transfer) => total + transfer.amountMinor, 0),
      pendingCount: transfers.filter((transfer) => transfer.status === 'PENDING').length,
      settledCount: transfers.filter((transfer) => transfer.status === 'SETTLED').length,
      failedCount: transfers.filter((transfer) => transfer.status === 'FAILED').length,
      accountCount: accounts.length,
      recentTransfers: transfers.slice(0, 5),
      volumeByHour: [...byHour.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([hour, amountMinor]) => ({ hour, amountMinor })),
      generatedAt: this.runtime.now().toISOString(),
    };
  }
}

function hashRequest(value: Record<string, string | number>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
