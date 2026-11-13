import { describe, expect, it, vi } from 'vitest';
import type {
  CreateFxQuoteCommand,
  CreateFxConversionCommand,
  FxQuoteView,
  CreateTransferCommand,
  CreateWalletFundingCommand,
} from '@ledgerflow/contracts';
import type { ExchangeRateProvider } from '../fx/exchange-rate.provider.js';
import {
  IdempotencyConflictError,
  LedgerApplicationService,
} from './ledger-application.service.js';
import { InMemoryLedgerRepository } from '../../test/in-memory-ledger.repository.js';

const alice = {
  id: 'wallet-alice',
  code: 'WALLET-ALICE',
  name: 'Alice Wallet',
  type: 'LIABILITY' as const,
  currency: 'USD' as const,
  balanceMinor: 10_000,
};

const bob = {
  id: 'wallet-bob',
  code: 'WALLET-BOB',
  name: 'Bob Wallet',
  type: 'LIABILITY' as const,
  currency: 'USD' as const,
  balanceMinor: 5_000,
};

const platformCash = {
  id: 'platform-cash',
  code: '1000-CASH',
  name: 'Platform Cash',
  type: 'ASSET' as const,
  currency: 'USD' as const,
  balanceMinor: 15_000,
};

const aliceEuro = {
  id: 'wallet-alice-eur',
  code: 'WALLET-ALICE-EUR',
  name: 'Alice EUR Wallet',
  type: 'LIABILITY' as const,
  currency: 'EUR' as const,
  balanceMinor: 1_000,
};

const platformEuroCash = {
  id: 'platform-cash-eur',
  code: '1000-CASH-EUR',
  name: 'Platform EUR Cash',
  type: 'ASSET' as const,
  currency: 'EUR' as const,
  balanceMinor: 20_000,
};

const bobEuro = {
  id: 'wallet-bob-eur',
  code: 'WALLET-BOB-EUR',
  name: 'Bob EUR Wallet',
  type: 'LIABILITY' as const,
  currency: 'EUR' as const,
  balanceMinor: 500,
};

const fxQuote: FxQuoteView = {
  id: 'quote-001',
  provider: 'frankfurter',
  sourceCurrency: 'USD',
  destinationCurrency: 'EUR',
  sourceAmountMinor: 10_000,
  destinationAmountMinor: 9_024,
  rateDecimal: '0.90244',
  rateNumerator: '22561',
  rateDenominator: '25000',
  rateDate: '2026-11-13',
  createdAt: '2026-11-13T20:00:00.000Z',
  expiresAt: '2026-11-13T20:15:00.000Z',
};

const fxConversionCommand: CreateFxConversionCommand = {
  idempotencyKey: 'fx-conversion-001',
  quoteId: fxQuote.id,
  sourceAccountId: alice.id,
  destinationAccountId: aliceEuro.id,
  reference: 'Travel money',
};

const fundingCommand: CreateWalletFundingCommand = {
  idempotencyKey: 'funding-demo-001',
  walletId: 'wallet-alice',
  amountMinor: 5_000,
  currency: 'USD',
  reference: 'Bank cash-in',
};

const command: CreateTransferCommand = {
  idempotencyKey: 'transfer-demo-001',
  sourceWalletId: 'wallet-alice',
  destinationWalletId: 'wallet-bob',
  amountMinor: 2_500,
  currency: 'USD',
  reference: 'Dinner split',
};

function createFixture() {
  const repository = new InMemoryLedgerRepository([alice, bob]);
  const ids = [
    'transfer-001',
    'journal-001',
    'posting-001',
    'posting-002',
    'event-001',
    'reversal-transfer-001',
    'reversal-journal-001',
    'reversal-posting-001',
    'reversal-posting-002',
    'reversal-event-001',
  ];
  const service = new LedgerApplicationService(repository, {
    nextId: () => ids.shift() ?? 'unexpected-id',
    now: () => new Date('2026-11-11T20:00:00.000Z'),
  });
  return { repository, service };
}

function createFundingFixture() {
  const repository = new InMemoryLedgerRepository([platformCash, alice, bob]);
  const ids = ['funding-001', 'funding-journal-001', 'funding-posting-001', 'funding-posting-002'];
  const service = new LedgerApplicationService(repository, {
    nextId: () => ids.shift() ?? 'unexpected-id',
    now: () => new Date('2026-11-13T19:00:00.000Z'),
  });
  return { repository, service };
}

function createFxQuoteFixture(rateDecimal = '0.90244') {
  const repository = new InMemoryLedgerRepository([platformCash, alice, bob]);
  const getRate = vi.fn().mockResolvedValue({
    provider: 'frankfurter',
    base: 'USD' as const,
    quote: 'EUR' as const,
    decimal: rateDecimal,
    effectiveDate: '2026-11-13',
  });
  const provider: ExchangeRateProvider = {
    getRate,
  };
  const service = new LedgerApplicationService(
    repository,
    {
      nextId: () => 'quote-001',
      now: () => new Date('2026-11-13T20:00:00.000Z'),
    },
    provider,
  );
  return { getRate, repository, service };
}

async function createFxConversionFixture(
  overrides: {
    accounts?: Array<
      typeof alice | typeof aliceEuro | typeof platformCash | typeof platformEuroCash
    >;
    now?: string;
    quote?: FxQuoteView;
  } = {},
) {
  const repository = new InMemoryLedgerRepository(
    overrides.accounts ?? [platformCash, platformEuroCash, alice, aliceEuro],
  );
  await repository.createFxQuote(overrides.quote ?? fxQuote);
  const ids = [
    'fx-conversion-created-001',
    'fx-journal-001',
    'fx-posting-001',
    'fx-posting-002',
    'fx-posting-003',
    'fx-posting-004',
  ];
  const service = new LedgerApplicationService(repository, {
    nextId: () => ids.shift() ?? 'unexpected-id',
    now: () => new Date(overrides.now ?? '2026-11-13T20:05:00.000Z'),
  });
  return { repository, service };
}

describe('LedgerApplicationService', () => {
  it.each(['USD', 'EUR', 'GBP', 'EGP'] as const)(
    'creates a zero-balance %s pocket inside the same customer account',
    async (currency) => {
      const existingCurrency = currency === 'USD' ? ('EUR' as const) : ('USD' as const);
      const existingAccount = {
        id: `wallet-alice-${existingCurrency.toLowerCase()}`,
        code: `2100-ALICE-${existingCurrency}`,
        name: `Alice ${existingCurrency} Balance`,
        type: 'LIABILITY' as const,
        currency: existingCurrency,
        balanceMinor: 2_500,
      };
      const repository = new InMemoryLedgerRepository([existingAccount]);
      const service = new LedgerApplicationService(repository, {
        nextId: () => `balance-account-${currency.toLowerCase()}`,
        now: () => new Date('2026-11-13T21:00:00.000Z'),
      });

      const wallet = await service.createWalletBalance({ walletId: 'wallet-alice', currency });

      expect(wallet).toMatchObject({
        id: 'wallet-alice',
        ownerName: 'Alice',
      });
      expect(wallet.balances).toContainEqual({ currency, balanceMinor: 0 });
      expect(repository.inspect().accounts).toContainEqual({
        id: `balance-account-${currency.toLowerCase()}`,
        code: `2100-WALLET-ALICE-${currency}`,
        name: `Alice ${currency} Balance`,
        type: 'LIABILITY',
        currency,
        balanceMinor: 0,
      });
    },
  );

  it('rejects creating a duplicate currency balance without changing accounts', async () => {
    const repository = new InMemoryLedgerRepository([alice]);
    const service = new LedgerApplicationService(repository, {
      nextId: () => 'must-not-be-used',
      now: () => new Date('2026-11-13T21:00:00.000Z'),
    });
    const before = repository.inspect().accounts;

    await expect(
      service.createWalletBalance({ walletId: 'wallet-alice', currency: 'USD' }),
    ).rejects.toThrow('already has a USD balance');
    expect(repository.inspect().accounts).toEqual(before);
  });

  it('rejects currency-balance creation for an unknown customer account', async () => {
    const repository = new InMemoryLedgerRepository([alice]);
    const service = new LedgerApplicationService(repository, {
      nextId: () => 'must-not-be-used',
      now: () => new Date('2026-11-13T21:00:00.000Z'),
    });

    await expect(
      service.createWalletBalance({ walletId: 'wallet-charlie', currency: 'EGP' }),
    ).rejects.toThrow('Wallet was not found');
  });

  it('lists one customer account with all of its owned currency balances', async () => {
    const repository = new InMemoryLedgerRepository([alice, aliceEuro]);
    const service = new LedgerApplicationService(repository, {
      nextId: () => 'unused',
      now: () => new Date('2026-11-13T21:00:00.000Z'),
    });

    await expect(service.listWallets()).resolves.toEqual([
      {
        id: 'wallet-alice',
        ownerName: 'Alice',
        balances: [
          { currency: 'USD', balanceMinor: 10_000 },
          { currency: 'EUR', balanceMinor: 1_000 },
        ],
      },
    ]);
  });

  it('atomically converts across four accounts and persists two balanced currency legs', async () => {
    const { repository, service } = await createFxConversionFixture();

    const result = await service.createFxConversion(fxConversionCommand, 'correlation-fx-001');
    const state = repository.inspect();

    expect(result).toMatchObject({
      id: 'fx-conversion-created-001',
      quoteId: 'quote-001',
      sourceAmountMinor: 10_000,
      destinationAmountMinor: 9_024,
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      rateDecimal: '0.90244',
      journalId: 'fx-journal-001',
    });
    expect(state.fxConversions).toEqual([result]);
    expect(state.journals).toEqual([
      expect.objectContaining({
        id: 'fx-journal-001',
        fxConversionId: result.id,
        currencies: ['USD', 'EUR'],
        postings: [
          expect.objectContaining({ accountId: alice.id, currency: 'USD', side: 'DEBIT' }),
          expect.objectContaining({ accountId: platformCash.id, currency: 'USD', side: 'CREDIT' }),
          expect.objectContaining({
            accountId: platformEuroCash.id,
            currency: 'EUR',
            side: 'DEBIT',
          }),
          expect.objectContaining({ accountId: aliceEuro.id, currency: 'EUR', side: 'CREDIT' }),
        ],
      }),
    ]);
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(0);
    expect(state.accounts.find((account) => account.id === platformCash.id)?.balanceMinor).toBe(
      5_000,
    );
    expect(state.accounts.find((account) => account.id === platformEuroCash.id)?.balanceMinor).toBe(
      29_024,
    );
    expect(state.accounts.find((account) => account.id === aliceEuro.id)?.balanceMinor).toBe(
      10_024,
    );
  });

  it('replays the same conversion once and rejects a changed payload under the same key', async () => {
    const { repository, service } = await createFxConversionFixture();
    const first = await service.createFxConversion(fxConversionCommand, 'correlation-fx-001');

    await expect(
      service.createFxConversion(fxConversionCommand, 'correlation-fx-002'),
    ).resolves.toEqual(first);
    await expect(
      service.createFxConversion(
        { ...fxConversionCommand, destinationAccountId: 'another-wallet' },
        'correlation-fx-003',
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(repository.inspect().fxConversions).toHaveLength(1);
    expect(repository.inspect().journals).toHaveLength(1);
  });

  it('rejects an expired quote without mutating accounts', async () => {
    const { repository, service } = await createFxConversionFixture({
      now: '2026-11-13T20:15:00.000Z',
    });

    await expect(
      service.createFxConversion(fxConversionCommand, 'correlation-fx-001'),
    ).rejects.toThrow('expired');
    expect(repository.inspect().fxConversions).toEqual([]);
    expect(repository.inspect().accounts).toEqual([
      platformCash,
      platformEuroCash,
      alice,
      aliceEuro,
    ]);
  });

  it.each([
    ['wallet', { ...alice, balanceMinor: 9_999 }, platformCash, 'wallet balance'],
    ['cash', alice, { ...platformCash, balanceMinor: 9_999 }, 'cash balance'],
  ])(
    'rolls back when source %s is insufficient',
    async (_label, sourceWallet, sourceCash, message) => {
      const { repository, service } = await createFxConversionFixture({
        accounts: [sourceCash, platformEuroCash, sourceWallet, aliceEuro],
      });
      const before = repository.inspect().accounts;

      await expect(
        service.createFxConversion(fxConversionCommand, 'correlation-fx-001'),
      ).rejects.toThrow(message);
      expect(repository.inspect().accounts).toEqual(before);
      expect(repository.inspect().fxConversions).toEqual([]);
      expect(repository.inspect().journals).toEqual([]);
    },
  );

  it('persists an immutable quote with exact provider-rate evidence and a 15-minute expiry', async () => {
    const { getRate, repository, service } = createFxQuoteFixture();
    const command: CreateFxQuoteCommand = {
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      sourceAmountMinor: 10_000,
    };

    const result = await service.createFxQuote(command);

    expect(getRate).toHaveBeenCalledWith('USD', 'EUR');
    expect(result).toEqual({
      id: 'quote-001',
      provider: 'frankfurter',
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      sourceAmountMinor: 10_000,
      destinationAmountMinor: 9_024,
      rateDecimal: '0.90244',
      rateNumerator: '22561',
      rateDenominator: '25000',
      rateDate: '2026-11-13',
      createdAt: '2026-11-13T20:00:00.000Z',
      expiresAt: '2026-11-13T20:15:00.000Z',
    });
    expect(repository.inspect().fxQuotes).toEqual([result]);
  });

  it('does not persist a quote when the provider returns malformed rate text', async () => {
    const { repository, service } = createFxQuoteFixture('1e2');

    await expect(
      service.createFxQuote({
        sourceCurrency: 'USD',
        destinationCurrency: 'EUR',
        sourceAmountMinor: 10_000,
      }),
    ).rejects.toThrow('positive decimal');
    expect(repository.inspect().fxQuotes).toEqual([]);
  });

  it('rejects same-currency quote requests before contacting the provider', async () => {
    const { getRate, repository, service } = createFxQuoteFixture();

    await expect(
      service.createFxQuote({
        sourceCurrency: 'USD',
        destinationCurrency: 'USD',
        sourceAmountMinor: 10_000,
      }),
    ).rejects.toThrow('different currencies');
    expect(getRate).not.toHaveBeenCalled();
    expect(repository.inspect().fxQuotes).toEqual([]);
  });

  it('atomically posts wallet funding, a balanced journal, and both normal-side balances', async () => {
    const { repository, service } = createFundingFixture();

    const result = await service.createWalletFunding(fundingCommand, 'correlation-funding-001');
    const state = repository.inspect();

    expect(result).toMatchObject({
      id: 'funding-001',
      journalId: 'funding-journal-001',
      walletName: 'Alice Wallet',
      amountMinor: 5_000,
    });
    expect(state.walletFundings).toEqual([result]);
    expect(state.journals[0]).toMatchObject({
      id: 'funding-journal-001',
      fundingId: 'funding-001',
      postings: [
        expect.objectContaining({ accountId: platformCash.id, side: 'DEBIT', amountMinor: 5_000 }),
        expect.objectContaining({ accountId: alice.id, side: 'CREDIT', amountMinor: 5_000 }),
      ],
    });
    expect(state.accounts.find((account) => account.id === platformCash.id)?.balanceMinor).toBe(
      20_000,
    );
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(15_000);
    await expect(service.listWalletFundings(1, 25)).resolves.toMatchObject({
      items: [result],
      total: 1,
      page: 1,
      pageSize: 25,
    });
  });

  it('returns one wallet funding when the same key and payload are replayed', async () => {
    const { repository, service } = createFundingFixture();

    const first = await service.createWalletFunding(fundingCommand, 'correlation-funding-001');
    const replay = await service.createWalletFunding(fundingCommand, 'correlation-funding-002');

    expect(replay).toEqual(first);
    expect(repository.inspectIdempotencyLocks()).toEqual([
      fundingCommand.idempotencyKey,
      fundingCommand.idempotencyKey,
    ]);
    expect(repository.inspect().walletFundings).toHaveLength(1);
    expect(repository.inspect().journals).toHaveLength(1);
  });

  it('funds a non-USD balance from platform cash in the same currency', async () => {
    const platformEgp = {
      ...platformCash,
      id: 'platform-cash-egp',
      code: '1000-CASH-EGP',
      name: 'Platform EGP Cash',
      currency: 'EGP' as const,
      balanceMinor: 30_000,
    };
    const aliceEgp = {
      ...alice,
      id: 'wallet-alice-egp',
      code: '2100-ALICE-EGP',
      name: 'Alice EGP Balance',
      currency: 'EGP' as const,
      balanceMinor: 1_000,
    };
    const repository = new InMemoryLedgerRepository([platformCash, platformEgp, aliceEgp]);
    const ids = ['funding-egp', 'journal-egp', 'posting-cash-egp', 'posting-wallet-egp'];
    const service = new LedgerApplicationService(repository, {
      nextId: () => ids.shift() ?? 'unexpected-id',
      now: () => new Date('2026-11-13T21:45:00.000Z'),
    });

    const result = await service.createWalletFunding(
      { ...fundingCommand, idempotencyKey: 'funding-egp', currency: 'EGP', amountMinor: 2_000 },
      'correlation-egp',
    );

    expect(result).toMatchObject({ currency: 'EGP', amountMinor: 2_000 });
    expect(repository.inspect().accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: platformCash.id, balanceMinor: 15_000 }),
        expect.objectContaining({ id: platformEgp.id, balanceMinor: 32_000 }),
        expect.objectContaining({ id: aliceEgp.id, balanceMinor: 3_000 }),
      ]),
    );
  });

  it('rejects a changed wallet-funding payload under an existing key', async () => {
    const { service } = createFundingFixture();
    await service.createWalletFunding(fundingCommand, 'correlation-funding-001');

    await expect(
      service.createWalletFunding(
        { ...fundingCommand, amountMinor: 5_001 },
        'correlation-funding-002',
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('rolls back wallet funding when either ledger account is missing', async () => {
    const { repository, service } = createFundingFixture();

    await expect(
      service.createWalletFunding(
        { ...fundingCommand, walletId: 'wallet-missing' },
        'correlation-funding-001',
      ),
    ).rejects.toThrow('Wallet USD balance was not found');

    const state = repository.inspect();
    expect(state.walletFundings).toHaveLength(0);
    expect(state.journals).toHaveLength(0);
    expect(state.accounts.find((account) => account.id === platformCash.id)?.balanceMinor).toBe(
      15_000,
    );
  });

  it('atomically creates one transfer, balanced journal, balance update, and outbox event', async () => {
    const { repository, service } = createFixture();

    const result = await service.createTransfer(command, 'correlation-001');
    const state = repository.inspect();

    expect(result).toMatchObject({
      id: 'transfer-001',
      status: 'PENDING',
      journalId: 'journal-001',
      amountMinor: 2500,
    });
    expect(state.journals).toHaveLength(1);
    expect(state.journals[0]?.postings).toEqual([
      expect.objectContaining({ accountId: alice.id, side: 'DEBIT', amountMinor: 2500 }),
      expect.objectContaining({ accountId: bob.id, side: 'CREDIT', amountMinor: 2500 }),
    ]);
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(7500);
    expect(state.accounts.find((account) => account.id === bob.id)?.balanceMinor).toBe(7500);
    expect(state.outbox).toEqual([
      expect.objectContaining({
        id: 'event-001',
        eventName: 'transfer.posted.v1',
        correlationId: 'correlation-001',
      }),
    ]);
  });

  it('creates a same-currency EUR transfer between two different customer accounts', async () => {
    const repository = new InMemoryLedgerRepository([aliceEuro, bobEuro]);
    const ids = ['transfer-eur', 'journal-eur', 'p1', 'p2', 'event-eur'];
    const service = new LedgerApplicationService(repository, {
      nextId: () => ids.shift() ?? 'unexpected-id',
      now: () => new Date('2026-11-13T21:30:00.000Z'),
    });

    const result = await service.createTransfer(
      { ...command, idempotencyKey: 'transfer-eur', currency: 'EUR', amountMinor: 250 },
      'correlation-eur',
    );

    expect(result).toMatchObject({ currency: 'EUR', amountMinor: 250 });
    expect(repository.inspect().accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: aliceEuro.id, balanceMinor: 750 }),
        expect.objectContaining({ id: bobEuro.id, balanceMinor: 750 }),
      ]),
    );
  });

  it('rejects sending to the same customer account before changing balances', async () => {
    const { repository, service } = createFixture();

    await expect(
      service.createTransfer(
        { ...command, destinationWalletId: command.sourceWalletId },
        'correlation-self',
      ),
    ).rejects.toThrow('different customer accounts');
    expect(repository.inspect().accounts).toEqual([alice, bob]);
  });

  it('rejects a destination customer that does not own the selected currency', async () => {
    const bobGbp = { ...bob, id: 'wallet-bob-gbp', currency: 'GBP' as const };
    const repository = new InMemoryLedgerRepository([alice, bobGbp]);
    const service = new LedgerApplicationService(repository, {
      nextId: () => 'unused',
      now: () => new Date('2026-11-13T21:30:00.000Z'),
    });

    await expect(service.createTransfer(command, 'correlation-missing')).rejects.toThrow(
      'Destination wallet USD balance was not found',
    );
    expect(repository.inspect().transfers).toHaveLength(0);
  });

  it('returns the original result when the same idempotency key and payload are replayed', async () => {
    const { repository, service } = createFixture();

    const first = await service.createTransfer(command, 'correlation-001');
    const replay = await service.createTransfer(command, 'correlation-002');

    expect(replay).toEqual(first);
    expect(repository.inspect().transfers).toHaveLength(1);
    expect(repository.inspect().outbox).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const { service } = createFixture();
    await service.createTransfer(command, 'correlation-001');

    await expect(
      service.createTransfer({ ...command, amountMinor: 2600 }, 'correlation-002'),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('rolls back all records when the source balance is insufficient', async () => {
    const { repository, service } = createFixture();

    await expect(
      service.createTransfer({ ...command, amountMinor: 10_001 }, 'correlation-001'),
    ).rejects.toThrow('Insufficient balance');

    const state = repository.inspect();
    expect(state.transfers).toHaveLength(0);
    expect(state.journals).toHaveLength(0);
    expect(state.outbox).toHaveLength(0);
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(10_000);
  });

  it('reverses a posted transfer with a new compensating journal', async () => {
    const { repository, service } = createFixture();
    const transfer = await service.createTransfer(command, 'correlation-001');

    const reversed = await service.reverseTransfer(
      {
        transferId: transfer.id,
        idempotencyKey: 'reverse-demo-001',
        reason: 'Operator correction',
      },
      'correlation-002',
    );

    const state = repository.inspect();
    expect(reversed.status).toBe('REVERSED');
    expect(state.journals).toHaveLength(2);
    expect(state.journals[1]).toMatchObject({
      reversalOfJournalId: 'journal-001',
      postings: [
        expect.objectContaining({ accountId: alice.id, side: 'CREDIT', amountMinor: 2500 }),
        expect.objectContaining({ accountId: bob.id, side: 'DEBIT', amountMinor: 2500 }),
      ],
    });
    expect(state.accounts.find((account) => account.id === alice.id)?.balanceMinor).toBe(10_000);
    expect(state.accounts.find((account) => account.id === bob.id)?.balanceMinor).toBe(5_000);
  });

  it('returns a dashboard summary from persisted transfer state', async () => {
    const { service } = createFixture();
    const transfer = await service.createTransfer(command, 'correlation-001');

    const summary = await service.getSummary();
    const page = await service.listTransfers(1, 25);
    const journal = await service.getJournal(transfer.journalId);

    expect(summary).toMatchObject({
      totalVolumeMinor: 2500,
      settledVolumeMinor: 0,
      pendingCount: 1,
      settledCount: 0,
      failedCount: 0,
      accountCount: 2,
      recentTransfers: [expect.objectContaining({ id: 'transfer-001' })],
      volumeByHour: [{ hour: '2026-11-11T20:00:00.000Z', amountMinor: 2500 }],
      generatedAt: '2026-11-11T20:00:00.000Z',
    });
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 25 });
    expect(journal.id).toBe('journal-001');
  });
});
