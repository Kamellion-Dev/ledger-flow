import type {
  AccountView,
  Currency,
  FxConversionView,
  FxQuoteView,
  JournalView,
  SettlementView,
  TransferView,
  WalletView,
  WalletFundingView,
} from '@ledgerflow/contracts';
import type {
  CreateTransferAggregate,
  CreateFxConversionAggregate,
  CreateWalletFundingAggregate,
  CreateWalletBalanceRecord,
  IdempotencyRecord,
  LedgerRepository,
  LedgerUnitOfWork,
  ReverseTransferAggregate,
} from '../ledger/ledger-repository.js';
import {
  FxConversionStateError,
  TransferStateError,
} from '../ledger/ledger-application.service.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import {
  mapAccount,
  mapFxConversion,
  mapFxQuote,
  mapJournal,
  mapSettlement,
  mapTransfer,
  mapWalletFunding,
  mapWallet,
} from './prisma-mappers.js';

const journalInclude = { postings: { include: { account: true } } } as const;
const walletFundingInclude = { walletAccount: true } as const;
const walletInclude = {
  balances: { include: { account: true }, orderBy: { currency: 'asc' as const } },
} as const;

export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (unitOfWork: LedgerUnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((transaction) => work(new PrismaLedgerUnitOfWork(transaction)));
  }

  async createFxQuote(quote: FxQuoteView): Promise<void> {
    await this.prisma.fxQuote.create({
      data: {
        id: quote.id,
        provider: quote.provider,
        sourceCurrency: quote.sourceCurrency,
        destinationCurrency: quote.destinationCurrency,
        sourceAmountMinor: BigInt(quote.sourceAmountMinor),
        destinationAmountMinor: BigInt(quote.destinationAmountMinor),
        rateDecimal: quote.rateDecimal,
        rateNumerator: BigInt(quote.rateNumerator),
        rateDenominator: BigInt(quote.rateDenominator),
        rateDate: new Date(`${quote.rateDate}T00:00:00.000Z`),
        createdAt: new Date(quote.createdAt),
        expiresAt: new Date(quote.expiresAt),
      },
    });
  }

  async listAccounts(): Promise<AccountView[]> {
    const rows = await this.prisma.account.findMany({ orderBy: { code: 'asc' } });
    return rows.map(mapAccount);
  }

  async listWallets(): Promise<WalletView[]> {
    const rows = await this.prisma.wallet.findMany({
      include: walletInclude,
      orderBy: { ownerName: 'asc' },
    });
    return rows.map(mapWallet);
  }

  async listFxConversions(
    page: number,
    pageSize: number,
  ): Promise<{ items: FxConversionView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fxConversion.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fxConversion.count(),
    ]);
    return { items: rows.map(mapFxConversion), total };
  }

  async listTransfers(
    page: number,
    pageSize: number,
  ): Promise<{ items: TransferView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transfer.count(),
    ]);
    return { items: rows.map(mapTransfer), total };
  }

  async listWalletFundings(
    page: number,
    pageSize: number,
  ): Promise<{ items: WalletFundingView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletFunding.findMany({
        include: walletFundingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.walletFunding.count(),
    ]);
    return { items: rows.map(mapWalletFunding), total };
  }

  async listSettlements(
    page: number,
    pageSize: number,
  ): Promise<{ items: SettlementView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.settlement.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.settlement.count(),
    ]);
    return { items: rows.map(mapSettlement), total };
  }

  async findJournal(id: string): Promise<JournalView | undefined> {
    const row = await this.prisma.journal.findUnique({ where: { id }, include: journalInclude });
    return row ? mapJournal(row) : undefined;
  }
}

class PrismaLedgerUnitOfWork implements LedgerUnitOfWork {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async lockIdempotencyKey(key: string): Promise<void> {
    await this.transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked
    `;
  }

  async findAccount(id: string): Promise<AccountView | undefined> {
    const row = await this.transaction.account.findUnique({ where: { id } });
    return row ? mapAccount(row) : undefined;
  }

  async findWallet(id: string): Promise<WalletView | undefined> {
    const row = await this.transaction.wallet.findUnique({
      where: { id },
      include: walletInclude,
    });
    return row ? mapWallet(row) : undefined;
  }

  async findWalletBalanceAccount(
    walletId: string,
    currency: Currency,
  ): Promise<AccountView | undefined> {
    const row = await this.transaction.walletBalance.findUnique({
      where: { walletId_currency: { walletId, currency } },
      include: { account: true },
    });
    return row ? mapAccount(row.account) : undefined;
  }

  async findTransfer(id: string): Promise<TransferView | undefined> {
    const row = await this.transaction.transfer.findUnique({ where: { id } });
    return row ? mapTransfer(row) : undefined;
  }

  async findWalletFunding(id: string): Promise<WalletFundingView | undefined> {
    const row = await this.transaction.walletFunding.findUnique({
      where: { id },
      include: walletFundingInclude,
    });
    return row ? mapWalletFunding(row) : undefined;
  }

  async findFxQuote(id: string): Promise<FxQuoteView | undefined> {
    const row = await this.transaction.fxQuote.findUnique({ where: { id } });
    return row ? mapFxQuote(row) : undefined;
  }

  async findFxConversion(id: string): Promise<FxConversionView | undefined> {
    const row = await this.transaction.fxConversion.findUnique({ where: { id } });
    return row ? mapFxConversion(row) : undefined;
  }

  async findPlatformCashAccount(currency: Currency): Promise<AccountView | undefined> {
    const row = await this.transaction.account.findFirst({
      where: { type: 'ASSET', currency },
      orderBy: { code: 'asc' },
    });
    return row ? mapAccount(row) : undefined;
  }

  async findJournal(id: string): Promise<JournalView | undefined> {
    const row = await this.transaction.journal.findUnique({
      where: { id },
      include: journalInclude,
    });
    return row ? mapJournal(row) : undefined;
  }

  async findIdempotency(key: string): Promise<IdempotencyRecord | undefined> {
    const row = await this.transaction.idempotencyRecord.findUnique({ where: { key } });
    return row
      ? {
          key: row.key,
          operation: row.operation,
          requestHash: row.requestHash,
          resourceId: row.resourceId,
          createdAt: row.createdAt.toISOString(),
        }
      : undefined;
  }

  async createTransfer(aggregate: CreateTransferAggregate): Promise<void> {
    const amountMinor = BigInt(aggregate.transfer.amountMinor);
    const sourceUpdate = await this.transaction.account.updateMany({
      where: {
        id: aggregate.transfer.sourceAccountId,
        balanceMinor: { gte: amountMinor },
      },
      data: { balanceMinor: { decrement: amountMinor } },
    });
    if (sourceUpdate.count !== 1) {
      throw new TransferStateError('Source account balance changed or is insufficient');
    }
    await this.transaction.account.update({
      where: { id: aggregate.transfer.destinationAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });
    await this.transaction.transfer.create({
      data: {
        id: aggregate.transfer.id,
        idempotencyKey: aggregate.transfer.idempotencyKey,
        sourceAccountId: aggregate.transfer.sourceAccountId,
        destinationAccountId: aggregate.transfer.destinationAccountId,
        amountMinor: BigInt(aggregate.transfer.amountMinor),
        currency: aggregate.transfer.currency,
        reference: aggregate.transfer.reference,
        status: aggregate.transfer.status,
        journalId: aggregate.transfer.journalId,
        createdAt: new Date(aggregate.transfer.createdAt),
      },
    });
    await this.transaction.journal.create({
      data: {
        id: aggregate.journal.id,
        transferId: aggregate.transfer.id,
        currency: aggregate.journal.currency ?? null,
        reference: aggregate.journal.reference,
        createdAt: new Date(aggregate.journal.createdAt),
        postings: {
          create: aggregate.journal.postings.map((posting) => ({
            id: posting.id,
            accountId: posting.accountId,
            side: posting.side,
            amountMinor: BigInt(posting.amountMinor),
            currency: posting.currency,
            createdAt: new Date(aggregate.journal.createdAt),
          })),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        ...aggregate.idempotency,
        createdAt: new Date(aggregate.idempotency.createdAt),
      },
    });
    await this.transaction.outboxEvent.create({
      data: {
        id: aggregate.outbox.id,
        eventName: aggregate.outbox.eventName,
        correlationId: aggregate.outbox.correlationId,
        payload: toJson(aggregate.outbox.event),
        status: aggregate.outbox.status,
        attemptCount: aggregate.outbox.attemptCount,
        createdAt: new Date(aggregate.outbox.createdAt),
      },
    });
  }

  async createWalletBalance(record: CreateWalletBalanceRecord): Promise<void> {
    await this.transaction.account.create({
      data: {
        id: record.account.id,
        code: record.account.code,
        name: record.account.name,
        type: record.account.type,
        currency: record.account.currency,
        balanceMinor: BigInt(record.account.balanceMinor),
      },
    });
    await this.transaction.walletBalance.create({
      data: {
        walletId: record.walletId,
        currency: record.currency,
        accountId: record.account.id,
      },
    });
  }

  async createWalletFunding(aggregate: CreateWalletFundingAggregate): Promise<void> {
    const amountMinor = BigInt(aggregate.funding.amountMinor);
    await this.transaction.account.update({
      where: { id: aggregate.funding.fundingAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });
    await this.transaction.account.update({
      where: { id: aggregate.funding.walletAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });
    await this.transaction.walletFunding.create({
      data: {
        id: aggregate.funding.id,
        idempotencyKey: aggregate.funding.idempotencyKey,
        fundingAccountId: aggregate.funding.fundingAccountId,
        walletAccountId: aggregate.funding.walletAccountId,
        amountMinor,
        currency: aggregate.funding.currency,
        reference: aggregate.funding.reference,
        journalId: aggregate.funding.journalId,
        createdAt: new Date(aggregate.funding.createdAt),
      },
    });
    await this.transaction.journal.create({
      data: {
        id: aggregate.journal.id,
        fundingId: aggregate.funding.id,
        currency: aggregate.journal.currency ?? null,
        reference: aggregate.journal.reference,
        createdAt: new Date(aggregate.journal.createdAt),
        postings: {
          create: aggregate.journal.postings.map((posting) => ({
            id: posting.id,
            accountId: posting.accountId,
            side: posting.side,
            amountMinor: BigInt(posting.amountMinor),
            currency: posting.currency,
            createdAt: new Date(aggregate.journal.createdAt),
          })),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        ...aggregate.idempotency,
        createdAt: new Date(aggregate.idempotency.createdAt),
      },
    });
  }

  async createFxConversion(aggregate: CreateFxConversionAggregate): Promise<void> {
    const sourceAmountMinor = BigInt(aggregate.conversion.sourceAmountMinor);
    const destinationAmountMinor = BigInt(aggregate.conversion.destinationAmountMinor);
    const sourceWalletUpdate = await this.transaction.account.updateMany({
      where: {
        id: aggregate.conversion.sourceAccountId,
        balanceMinor: { gte: sourceAmountMinor },
      },
      data: { balanceMinor: { decrement: sourceAmountMinor } },
    });
    const sourceCashUpdate = await this.transaction.account.updateMany({
      where: {
        id: aggregate.sourceCashAccountId,
        balanceMinor: { gte: sourceAmountMinor },
      },
      data: { balanceMinor: { decrement: sourceAmountMinor } },
    });
    if (sourceWalletUpdate.count !== 1 || sourceCashUpdate.count !== 1) {
      throw new FxConversionStateError('FX source balance changed or is insufficient');
    }
    await this.transaction.account.update({
      where: { id: aggregate.destinationCashAccountId },
      data: { balanceMinor: { increment: destinationAmountMinor } },
    });
    await this.transaction.account.update({
      where: { id: aggregate.conversion.destinationAccountId },
      data: { balanceMinor: { increment: destinationAmountMinor } },
    });
    await this.transaction.fxConversion.create({
      data: {
        id: aggregate.conversion.id,
        idempotencyKey: aggregate.conversion.idempotencyKey,
        quoteId: aggregate.conversion.quoteId,
        sourceAccountId: aggregate.conversion.sourceAccountId,
        destinationAccountId: aggregate.conversion.destinationAccountId,
        sourceAmountMinor,
        destinationAmountMinor,
        sourceCurrency: aggregate.conversion.sourceCurrency,
        destinationCurrency: aggregate.conversion.destinationCurrency,
        rateDecimal: aggregate.conversion.rateDecimal,
        journalId: aggregate.conversion.journalId,
        reference: aggregate.conversion.reference,
        createdAt: new Date(aggregate.conversion.createdAt),
      },
    });
    await this.transaction.journal.create({
      data: {
        id: aggregate.journal.id,
        fxConversionId: aggregate.conversion.id,
        currency: null,
        reference: aggregate.journal.reference,
        createdAt: new Date(aggregate.journal.createdAt),
        postings: {
          create: aggregate.journal.postings.map((posting) => ({
            id: posting.id,
            accountId: posting.accountId,
            side: posting.side,
            amountMinor: BigInt(posting.amountMinor),
            currency: posting.currency,
            createdAt: new Date(aggregate.journal.createdAt),
          })),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        ...aggregate.idempotency,
        createdAt: new Date(aggregate.idempotency.createdAt),
      },
    });
  }

  async reverseTransfer(aggregate: ReverseTransferAggregate): Promise<void> {
    const transferUpdate = await this.transaction.transfer.updateMany({
      where: { id: aggregate.transfer.id, status: { not: 'REVERSED' } },
      data: {
        status: aggregate.transfer.status,
        reversedAt: aggregate.transfer.reversedAt ? new Date(aggregate.transfer.reversedAt) : null,
      },
    });
    if (transferUpdate.count !== 1) {
      throw new TransferStateError('Transfer was already reversed');
    }

    const amountMinor = BigInt(aggregate.transfer.amountMinor);
    await this.transaction.account.update({
      where: { id: aggregate.transfer.sourceAccountId },
      data: { balanceMinor: { increment: amountMinor } },
    });
    const destinationUpdate = await this.transaction.account.updateMany({
      where: {
        id: aggregate.transfer.destinationAccountId,
        balanceMinor: { gte: amountMinor },
      },
      data: { balanceMinor: { decrement: amountMinor } },
    });
    if (destinationUpdate.count !== 1) {
      throw new TransferStateError('Destination account cannot fund the reversal');
    }
    await this.transaction.journal.create({
      data: {
        id: aggregate.journal.id,
        transferId: aggregate.transfer.id,
        currency: aggregate.journal.currency ?? null,
        reference: aggregate.journal.reference,
        reversalOfJournalId: aggregate.journal.reversalOfJournalId ?? null,
        createdAt: new Date(aggregate.journal.createdAt),
        postings: {
          create: aggregate.journal.postings.map((posting) => ({
            id: posting.id,
            accountId: posting.accountId,
            side: posting.side,
            amountMinor: BigInt(posting.amountMinor),
            currency: posting.currency,
            createdAt: new Date(aggregate.journal.createdAt),
          })),
        },
      },
    });
    await this.transaction.idempotencyRecord.create({
      data: {
        ...aggregate.idempotency,
        createdAt: new Date(aggregate.idempotency.createdAt),
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
