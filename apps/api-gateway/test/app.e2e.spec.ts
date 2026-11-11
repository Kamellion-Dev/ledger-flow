import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { LEDGER_PORT, type LedgerPort } from '../src/ledger/ledger.port.js';
import { GrpcLedgerClient } from '../src/ledger/grpc-ledger.client.js';

class FakeLedgerPort implements LedgerPort {
  ready = true;
  readonly transfers: TransferView[] = [];

  createTransfer(command: CreateTransferCommand): Promise<TransferView> {
    const existing = this.transfers.find(
      (transfer) => transfer.idempotencyKey === command.idempotencyKey,
    );
    if (existing) return Promise.resolve(existing);
    const transfer: TransferView = {
      id: 'transfer-001',
      ...command,
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

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.DEMO_EMAIL = 'operator@ledgerflow.local';
    process.env.DEMO_PASSWORD = 'ledgerflow-demo';
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
  });

  it('validates a transfer and forwards its idempotency key', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'api-demo-001')
      .send({
        sourceAccountId: 'wallet-alice',
        destinationAccountId: 'wallet-bob',
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
        sourceAccountId: 'wallet-alice',
        destinationAccountId: 'wallet-bob',
        amountMinor: 0,
        currency: 'USD',
        reference: 'Invalid',
      })
      .expect(400);

    expect(ledger.transfers).toHaveLength(0);
  });

  it('keeps liveness available while readiness reports a ledger outage', async () => {
    ledger.ready = false;
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(503);
  });
});
