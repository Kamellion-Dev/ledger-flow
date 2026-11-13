import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  AccountView,
  CreateWalletBalanceCommand,
  CreateWalletFundingCommand,
  CreateFxConversionCommand,
  CreateFxQuoteCommand,
  CreateTransferCommand,
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
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { LEDGER_PORT, type LedgerPort } from '../src/ledger/ledger.port.js';
import { GrpcLedgerClient } from '../src/ledger/grpc-ledger.client.js';

class FakeLedgerPort implements LedgerPort {
  ready = true;
  createError?: Error & { code?: number; details?: string };
  fundingError?: Error & { code?: number; details?: string };
  quoteError?: Error & { code?: number; details?: string };
  readonly transfers: TransferView[] = [];
  readonly fundings: WalletFundingView[] = [];
  readonly conversions: FxConversionView[] = [];
  readonly wallets: WalletView[] = [
    {
      id: 'wallet-alice',
      ownerName: 'Alice',
      balances: [
        { currency: 'USD', balanceMinor: 10_000 },
        { currency: 'EUR', balanceMinor: 1_000 },
      ],
    },
    {
      id: 'wallet-bob',
      ownerName: 'Bob',
      balances: [
        { currency: 'USD', balanceMinor: 5_000 },
        { currency: 'GBP', balanceMinor: 500 },
      ],
    },
  ];

  listWallets(): Promise<WalletView[]> {
    return Promise.resolve(structuredClone(this.wallets));
  }
  createWalletBalance(command: CreateWalletBalanceCommand): Promise<WalletView> {
    const wallet = this.wallets.find((candidate) => candidate.id === command.walletId);
    if (!wallet) return Promise.reject(Object.assign(new Error('not found'), { code: 5 }));
    if (wallet.balances.some((balance) => balance.currency === command.currency)) {
      return Promise.reject(
        Object.assign(new Error('already exists'), {
          code: 6,
          details: `Wallet already has a ${command.currency} balance`,
        }),
      );
    }
    wallet.balances.push({ currency: command.currency, balanceMinor: 0 });
    return Promise.resolve(structuredClone(wallet));
  }

  createFxQuote(command: CreateFxQuoteCommand): Promise<FxQuoteView> {
    if (this.quoteError) return Promise.reject(this.quoteError);
    return Promise.resolve({
      id: 'quote-001',
      provider: 'frankfurter',
      ...command,
      destinationAmountMinor: 9_024,
      rateDecimal: '0.90244',
      rateNumerator: '22561',
      rateDenominator: '25000',
      rateDate: '2026-11-13',
      createdAt: '2026-11-13T20:00:00.000Z',
      expiresAt: '2026-11-13T20:15:00.000Z',
    });
  }
  createFxConversion(command: CreateFxConversionCommand): Promise<FxConversionView> {
    const existing = this.conversions.find(
      (conversion) => conversion.idempotencyKey === command.idempotencyKey,
    );
    if (existing) return Promise.resolve(existing);
    const conversion: FxConversionView = {
      id: 'conversion-001',
      ...command,
      sourceAmountMinor: 10_000,
      destinationAmountMinor: 9_024,
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      rateDecimal: '0.90244',
      journalId: 'fx-journal-001',
      createdAt: '2026-11-13T20:05:00.000Z',
    };
    this.conversions.push(conversion);
    return Promise.resolve(conversion);
  }
  listFxConversions(page: number, pageSize: number): Promise<Page<FxConversionView>> {
    return Promise.resolve({
      items: this.conversions,
      total: this.conversions.length,
      page,
      pageSize,
    });
  }

  createTransfer(command: CreateTransferCommand): Promise<TransferView> {
    if (this.createError) return Promise.reject(this.createError);
    if (command.sourceWalletId === command.destinationWalletId) {
      return Promise.reject(
        Object.assign(new Error('self transfer'), {
          code: 3,
          details: 'Transfers require two different customer accounts',
        }),
      );
    }
    const destination = this.wallets.find(
      (wallet) =>
        wallet.id === command.destinationWalletId &&
        wallet.balances.some((balance) => balance.currency === command.currency),
    );
    if (!destination) {
      return Promise.reject(
        Object.assign(new Error('missing balance'), {
          code: 5,
          details: `Destination wallet ${command.currency} balance was not found`,
        }),
      );
    }
    const existing = this.transfers.find(
      (transfer) => transfer.idempotencyKey === command.idempotencyKey,
    );
    if (existing) return Promise.resolve(existing);
    const transfer: TransferView = {
      id: 'transfer-001',
      ...command,
      sourceAccountId: `${command.sourceWalletId}-${command.currency}`,
      destinationAccountId: `${command.destinationWalletId}-${command.currency}`,
      status: 'PENDING',
      journalId: 'journal-001',
      createdAt: '2026-11-11T20:00:00.000Z',
    };
    this.transfers.push(transfer);
    return Promise.resolve(transfer);
  }
  reverseTransfer(_command: ReverseTransferCommand): Promise<TransferView> {
    throw new Error('not used in this test');
  }
  createWalletFunding(command: CreateWalletFundingCommand): Promise<WalletFundingView> {
    if (this.fundingError) return Promise.reject(this.fundingError);
    const existing = this.fundings.find(
      (funding) => funding.idempotencyKey === command.idempotencyKey,
    );
    if (existing) return Promise.resolve(existing);
    const funding: WalletFundingView = {
      id: 'funding-001',
      ...command,
      fundingAccountId: `platform-cash-${command.currency.toLowerCase()}`,
      walletAccountId: `${command.walletId}-${command.currency}`,
      walletName: 'Alice Wallet',
      journalId: 'funding-journal-001',
      createdAt: '2026-11-13T19:00:00.000Z',
    };
    this.fundings.push(funding);
    return Promise.resolve(funding);
  }
  listWalletFundings(page: number, pageSize: number): Promise<Page<WalletFundingView>> {
    return Promise.resolve({ items: this.fundings, total: this.fundings.length, page, pageSize });
  }
  listTransfers(page: number, pageSize: number): Promise<Page<TransferView>> {
    return Promise.resolve({ items: this.transfers, total: this.transfers.length, page, pageSize });
  }
  listAccounts(): Promise<AccountView[]> {
    return Promise.resolve([]);
  }
  listSettlements(page: number, pageSize: number): Promise<Page<SettlementView>> {
    return Promise.resolve({ items: [], total: 0, page, pageSize });
  }
  getJournal(_id: string): Promise<JournalView> {
    throw new Error('not used in this test');
  }
  getSummary(): Promise<DashboardSummary> {
    throw new Error('not used in this test');
  }
  health(): Promise<{ status: string }> {
    return this.ready ? Promise.resolve({ status: 'ok' }) : Promise.reject(new Error('offline'));
  }
}

describe('API gateway', () => {
  let app: INestApplication;
  let ledger: FakeLedgerPort;
  let token: string;
  let webRoot: string;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.DEMO_EMAIL = 'operator@ledgerflow.local';
    process.env.DEMO_PASSWORD = 'ledgerflow-demo';
    webRoot = mkdtempSync(join(tmpdir(), 'ledgerflow-web-'));
    writeFileSync(join(webRoot, 'index.html'), '<main>Nest-served LedgerFlow dashboard</main>');
    process.env.WEB_DIST_PATH = webRoot;
    ledger = new FakeLedgerPort();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LEDGER_PORT)
      .useValue(ledger)
      .overrideProvider(GrpcLedgerClient)
      .useValue(ledger)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'operator@ledgerflow.local',
      password: 'ledgerflow-demo',
    });
    token = response.body.accessToken as string;
  });

  afterEach(async () => {
    await app.close();
    rmSync(webRoot, { recursive: true, force: true });
    delete process.env.WEB_DIST_PATH;
  });

  it('issues a demo operator JWT and rejects incorrect credentials', async () => {
    expect(token.split('.')).toHaveLength(3);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'operator@ledgerflow.local', password: 'wrong-password' })
      .expect(401);
  });

  it('requires authentication for financial routes', async () => {
    await request(app.getHttpServer()).get('/api/transactions').expect(401);
    await request(app.getHttpServer()).get('/api/wallet-fundings').expect(401);
    await request(app.getHttpServer()).post('/api/fx/quotes').send({}).expect(401);
    await request(app.getHttpServer()).get('/api/wallets').expect(401);
  });

  it('lists customer accounts and creates any missing currency balance', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/wallets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toEqual(ledger.wallets);

    const created = await request(app.getHttpServer())
      .post('/api/wallets/wallet-alice/balances')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'EGP' })
      .expect(201);
    const createdWallet = created.body as WalletView;
    expect(createdWallet.id).toBe('wallet-alice');
    expect(createdWallet.balances).toContainEqual({ currency: 'EGP', balanceMinor: 0 });

    await request(app.getHttpServer())
      .post('/api/wallets/wallet-alice/balances')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'JPY' })
      .expect(400);
  });

  it('quotes, idempotently converts, and lists a real currency pair', async () => {
    const quote = await request(app.getHttpServer())
      .post('/api/fx/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceCurrency: 'USD', destinationCurrency: 'EUR', sourceAmountMinor: 10_000 })
      .expect(201);
    expect(quote.body).toMatchObject({
      provider: 'frankfurter',
      destinationAmountMinor: 9_024,
      rateDecimal: '0.90244',
    });
    const quoteBody = quote.body as unknown as FxQuoteView;

    const create = () =>
      request(app.getHttpServer())
        .post('/api/fx/conversions')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'fx-api-001')
        .send({
          quoteId: quoteBody.id,
          sourceAccountId: 'wallet-alice',
          destinationAccountId: 'wallet-alice-eur',
          reference: 'Travel money',
        })
        .expect(201);
    const first = await create();
    const replay = await create();
    const page = await request(app.getHttpServer())
      .get('/api/fx/conversions?page=1&pageSize=25')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(replay.body.id).toBe(first.body.id);
    expect(page.body).toMatchObject({ items: [first.body], total: 1, page: 1, pageSize: 25 });
    expect(ledger.conversions).toHaveLength(1);
  });

  it('validates FX input and maps an unavailable rate provider to 503', async () => {
    await request(app.getHttpServer())
      .post('/api/fx/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceCurrency: 'USD', destinationCurrency: 'USD', sourceAmountMinor: 10_000 })
      .expect(400);

    ledger.quoteError = Object.assign(new Error('14 UNAVAILABLE: Frankfurter request failed'), {
      code: 14,
      details: 'Exchange-rate provider is unavailable',
    });
    const unavailable = await request(app.getHttpServer())
      .post('/api/fx/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceCurrency: 'USD', destinationCurrency: 'EUR', sourceAmountMinor: 10_000 })
      .expect(503);
    expect(unavailable.body.message).toBe('Exchange-rate provider is unavailable');
  });

  it('creates and lists one idempotent wallet funding', async () => {
    const requestBody = {
      walletId: 'wallet-alice',
      amountMinor: 5_000,
      currency: 'EUR',
      reference: 'Bank cash-in',
    };
    const create = () =>
      request(app.getHttpServer())
        .post('/api/wallet-fundings')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'funding-api-001')
        .send(requestBody)
        .expect(201);

    const first = await create();
    const replay = await create();
    const page = await request(app.getHttpServer())
      .get('/api/wallet-fundings?page=1&pageSize=25')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(first.body).toMatchObject({
      id: 'funding-001',
      idempotencyKey: 'funding-api-001',
      walletName: 'Alice Wallet',
      amountMinor: 5_000,
    });
    expect(replay.body.id).toBe(first.body.id);
    expect(page.body).toMatchObject({ items: [first.body], total: 1, page: 1, pageSize: 25 });
    expect(ledger.fundings).toHaveLength(1);
  });

  it('validates wallet funding input and maps idempotency conflicts', async () => {
    await request(app.getHttpServer())
      .post('/api/wallet-fundings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'funding-invalid')
      .send({
        walletId: 'wallet-alice',
        amountMinor: 0,
        currency: 'USD',
        reference: 'Invalid amount',
      })
      .expect(400);

    ledger.fundingError = Object.assign(new Error('6 ALREADY_EXISTS: Changed payload'), {
      code: 6,
      details: 'Idempotency key was already used with a different payload',
    });
    const conflict = await request(app.getHttpServer())
      .post('/api/wallet-fundings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'funding-conflict')
      .send({
        walletId: 'wallet-alice',
        amountMinor: 5_000,
        currency: 'USD',
        reference: 'Changed payload',
      })
      .expect(409);

    expect(conflict.body.message).toBe('Idempotency key was already used with a different payload');
  });

  it('validates a transfer and forwards its idempotency key', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'api-demo-001')
      .send({
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 2500,
        currency: 'USD',
        reference: 'Dinner split',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      idempotencyKey: 'api-demo-001',
      amountMinor: 2500,
      status: 'PENDING',
    });
    expect(ledger.transfers).toHaveLength(1);
  });

  it('rejects missing idempotency and invalid amounts before calling the ledger', async () => {
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 0,
        currency: 'USD',
        reference: 'Invalid',
      })
      .expect(400);

    expect(ledger.transfers).toHaveLength(0);
  });

  it('maps a ledger gRPC validation failure to a useful client error', async () => {
    ledger.createError = Object.assign(
      new Error('3 INVALID_ARGUMENT: Wallet transfers require liability accounts'),
      {
        code: 3,
        details: 'Wallet transfers require liability accounts',
      },
    );

    const response = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'invalid-account-pair')
      .send({
        sourceWalletId: 'wallet-alice',
        destinationWalletId: 'wallet-bob',
        amountMinor: 2500,
        currency: 'USD',
        reference: 'Invalid account pair',
      })
      .expect(400);

    expect(response.body).toMatchObject({ message: 'Wallet transfers require liability accounts' });
  });

  it('rejects self-transfers, missing destination currencies, and legacy account-id payloads', async () => {
    const base = {
      sourceWalletId: 'wallet-alice',
      destinationWalletId: 'wallet-bob',
      amountMinor: 250,
      currency: 'USD',
      reference: 'Wallet transfer',
    };
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'self-transfer')
      .send({ ...base, destinationWalletId: 'wallet-alice' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'missing-eur')
      .send({ ...base, currency: 'EUR' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'legacy-transfer')
      .send({ ...base, sourceAccountId: 'wallet-alice' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/wallet-fundings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'legacy-funding')
      .send({
        walletId: 'wallet-alice',
        amountMinor: 500,
        currency: 'USD',
        reference: 'Legacy field',
        walletAccountId: 'wallet-alice',
      })
      .expect(400);
  });

  it('keeps liveness available while readiness reports a ledger outage', async () => {
    ledger.ready = false;
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(503);
  });

  it('serves the dashboard and SPA routes without capturing reserved backend routes', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200, /Nest-served LedgerFlow dashboard/);
    await request(app.getHttpServer())
      .get('/transactions')
      .expect(200, /Nest-served LedgerFlow dashboard/);

    const missingApi = await request(app.getHttpServer()).get('/api/not-a-real-route').expect(404);
    expect(missingApi.headers['content-type']).toContain('application/json');
    expect(missingApi.text).not.toContain('Nest-served LedgerFlow dashboard');
  });
});
