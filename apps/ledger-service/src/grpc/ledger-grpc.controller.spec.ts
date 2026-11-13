import { GrpcInternalException, GrpcUnavailableException } from '@nestjs/microservices';
import { describe, expect, it } from 'vitest';
import { LedgerApplicationService } from '../ledger/ledger-application.service.js';
import { InMemoryLedgerRepository } from '../../test/in-memory-ledger.repository.js';
import { LedgerGrpcController } from './ledger-grpc.controller.js';
import { ExchangeRateProviderError } from '../fx/exchange-rate.provider.js';

function createController() {
  const repository = new InMemoryLedgerRepository([
    {
      id: 'platform-cash',
      code: '1000-CASH',
      name: 'Platform Cash',
      type: 'ASSET',
      currency: 'USD',
      balanceMinor: 15_000,
    },
    {
      id: 'wallet-alice',
      code: 'WALLET-ALICE',
      name: 'Alice Wallet',
      type: 'LIABILITY',
      currency: 'USD',
      balanceMinor: 10_000,
    },
    {
      id: 'wallet-bob',
      code: 'WALLET-BOB',
      name: 'Bob Wallet',
      type: 'LIABILITY',
      currency: 'USD',
      balanceMinor: 5_000,
    },
    {
      id: 'platform-cash-eur',
      code: '1000-CASH-EUR',
      name: 'Platform EUR Cash',
      type: 'ASSET',
      currency: 'EUR',
      balanceMinor: 20_000,
    },
    {
      id: 'wallet-alice-eur',
      code: 'WALLET-ALICE-EUR',
      name: 'Alice EUR Wallet',
      type: 'LIABILITY',
      currency: 'EUR',
      balanceMinor: 0,
    },
  ]);
  let sequence = 0;
  const service = new LedgerApplicationService(
    repository,
    {
      nextId: () => `id-${++sequence}`,
      now: () => new Date('2026-11-13T20:00:00.000Z'),
    },
    {
      getRate: async (base, quote) => ({
        provider: 'frankfurter',
        base,
        quote,
        decimal: '0.90244',
        effectiveDate: '2026-11-13',
      }),
    },
  );
  return new LedgerGrpcController(service);
}

describe('LedgerGrpcController', () => {
  it('maps wallet listing and currency-balance creation without exposing ledger accounts', async () => {
    const calls: unknown[] = [];
    const wallet = {
      id: 'wallet-alice',
      ownerName: 'Alice',
      balances: [{ currency: 'USD' as const, balanceMinor: 10_000 }],
    };
    const service = {
      listWallets: async () => [wallet],
      createWalletBalance: async (command: unknown) => {
        calls.push(command);
        return {
          ...wallet,
          balances: [...wallet.balances, { currency: 'EGP' as const, balanceMinor: 0 }],
        };
      },
    } as unknown as LedgerApplicationService;
    const controller = new LedgerGrpcController(service);

    await expect(controller.listWallets()).resolves.toEqual({ items: [wallet] });
    await expect(
      controller.createWalletBalance({ walletId: 'wallet-alice', currency: 'EGP' }),
    ).resolves.toMatchObject({
      id: 'wallet-alice',
      balances: [{ currency: 'USD' }, { currency: 'EGP', balanceMinor: 0 }],
    });
    expect(calls).toEqual([{ walletId: 'wallet-alice', currency: 'EGP' }]);
  });

  it('maps wallet identities rather than public ledger account ids for money commands', async () => {
    const calls: unknown[] = [];
    const service = {
      createTransfer: async (command: unknown) => {
        calls.push(command);
        return { id: 'transfer-1' };
      },
      createWalletFunding: async (command: unknown) => {
        calls.push(command);
        return { id: 'funding-1' };
      },
    } as unknown as LedgerApplicationService;
    const controller = new LedgerGrpcController(service);

    await controller.createTransfer({
      idempotencyKey: 'transfer-wallet-contract',
      sourceWalletId: 'wallet-alice',
      destinationWalletId: 'wallet-bob',
      amountMinor: 2500,
      currency: 'EUR',
      reference: 'Same-currency payment',
      correlationId: 'correlation-transfer',
    });
    await controller.createWalletFunding({
      idempotencyKey: 'funding-wallet-contract',
      walletId: 'wallet-alice',
      amountMinor: 5000,
      currency: 'EGP',
      reference: 'Admin top up',
      correlationId: 'correlation-funding',
    });

    expect(calls).toEqual([
      {
        idempotencyKey: 'transfer-wallet-contract',
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 2500,
        currency: 'EUR',
        reference: 'Same-currency payment',
      },
      {
        idempotencyKey: 'funding-wallet-contract',
        walletId: 'wallet-alice',
        amountMinor: 5000,
        currency: 'EGP',
        reference: 'Admin top up',
      },
    ]);
  });

  it('maps quote and idempotent conversion RPCs and lists the conversion', async () => {
    const controller = createController();
    const quote = await controller.createFxQuote({
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      sourceAmountMinor: 10_000,
    });
    const conversion = await controller.createFxConversion({
      idempotencyKey: 'fx-grpc-001',
      quoteId: quote.id,
      sourceAccountId: 'wallet-alice',
      destinationAccountId: 'wallet-alice-eur',
      reference: 'Travel money',
      correlationId: 'correlation-fx-001',
    });
    const replay = await controller.createFxConversion({
      idempotencyKey: 'fx-grpc-001',
      quoteId: quote.id,
      sourceAccountId: 'wallet-alice',
      destinationAccountId: 'wallet-alice-eur',
      reference: 'Travel money',
      correlationId: 'correlation-fx-002',
    });
    const page = await controller.listFxConversions({ page: 1, pageSize: 25 });

    expect(quote).toMatchObject({ destinationAmountMinor: 9_024, rateDecimal: '0.90244' });
    expect(replay).toEqual(conversion);
    expect(page).toMatchObject({ items: [conversion], total: 1, page: 1, pageSize: 25 });
  });

  it('maps exchange-rate provider failures to gRPC unavailable', async () => {
    const service = {
      createFxQuote: async () => {
        throw new ExchangeRateProviderError('Frankfurter request failed');
      },
    } as unknown as LedgerApplicationService;

    await expect(
      new LedgerGrpcController(service).createFxQuote({
        sourceCurrency: 'USD',
        destinationCurrency: 'EUR',
        sourceAmountMinor: 10_000,
      }),
    ).rejects.toEqual(new GrpcUnavailableException('Frankfurter request failed'));
  });

  it('maps wallet-funding requests and lists the posted resource', async () => {
    const funding = {
      id: 'funding-1',
      journalId: 'journal-1',
      walletName: 'Alice Wallet',
      amountMinor: 5_000,
    };
    const service = {
      createWalletFunding: async () => funding,
      listWalletFundings: async () => ({ items: [funding], total: 1, page: 1, pageSize: 25 }),
    } as unknown as LedgerApplicationService;
    const controller = new LedgerGrpcController(service);

    const created = await controller.createWalletFunding({
      idempotencyKey: 'funding-grpc-001',
      walletId: 'wallet-alice',
      amountMinor: 5_000,
      currency: 'USD',
      reference: 'Bank cash-in',
      correlationId: 'correlation-funding-001',
    });
    const page = await controller.listWalletFundings({ page: 1, pageSize: 25 });

    expect(created).toMatchObject({
      id: 'funding-1',
      journalId: 'journal-1',
      walletName: 'Alice Wallet',
      amountMinor: 5_000,
    });
    expect(page).toMatchObject({ items: [funding], total: 1, page: 1, pageSize: 25 });
  });

  it('maps a protobuf transfer request into the application command', async () => {
    const service = {
      createTransfer: async () => ({
        id: 'transfer-1',
        journalId: 'journal-1',
        status: 'PENDING',
        amountMinor: 2500,
      }),
    } as unknown as LedgerApplicationService;
    const controller = new LedgerGrpcController(service);

    const transfer = await controller.createTransfer({
      idempotencyKey: 'grpc-demo-001',
      sourceWalletId: 'wallet-alice',
      destinationWalletId: 'wallet-bob',
      amountMinor: 2500,
      currency: 'USD',
      reference: 'Dinner split',
      correlationId: 'correlation-001',
    });

    expect(transfer).toMatchObject({
      id: 'transfer-1',
      journalId: 'journal-1',
      status: 'PENDING',
      amountMinor: 2500,
    });
  });

  it('reports service liveness without querying dependencies', () => {
    expect(createController().health()).toEqual({ status: 'ok' });
  });

  it('hides unexpected infrastructure errors behind an internal status', async () => {
    const service = {
      createTransfer: async () => {
        throw new Error('database connection details');
      },
    } as unknown as LedgerApplicationService;
    const controller = new LedgerGrpcController(service);

    await expect(
      controller.createTransfer({
        idempotencyKey: 'grpc-demo-002',
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 500,
        currency: 'USD',
        reference: 'Private failure',
      }),
    ).rejects.toEqual(new GrpcInternalException('Ledger operation failed'));
  });
});
