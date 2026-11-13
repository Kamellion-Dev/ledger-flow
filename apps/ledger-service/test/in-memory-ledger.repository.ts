import type {
  AccountView,
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
  LedgerRepository,
  LedgerState,
  LedgerUnitOfWork,
  ReverseTransferAggregate,
} from '../src/ledger/ledger-repository.js';

export class InMemoryLedgerRepository implements LedgerRepository {
  private state: LedgerState;
  private readonly idempotencyLocks: string[] = [];

  constructor(accounts: AccountView[]) {
    const { wallets, walletBalances } = inferWallets(accounts);
    this.state = {
      accounts: structuredClone(accounts),
      transfers: [],
      journals: [],
      settlements: [],
      walletFundings: [],
      fxQuotes: [],
      fxConversions: [],
      idempotency: [],
      outbox: [],
      processedEventIds: [],
      wallets,
      walletBalances,
    };
  }

  inspect(): LedgerState {
    return structuredClone(this.state);
  }

  inspectIdempotencyLocks(): string[] {
    return [...this.idempotencyLocks];
  }

  async transaction<T>(work: (unitOfWork: LedgerUnitOfWork) => Promise<T>): Promise<T> {
    const draft = structuredClone(this.state);
    const unitOfWork = createUnitOfWork(draft, this.idempotencyLocks);
    const result = await work(unitOfWork);
    this.state = draft;
    return result;
  }

  async listAccounts(): Promise<AccountView[]> {
    return structuredClone(this.state.accounts);
  }

  async listWallets(): Promise<WalletView[]> {
    return this.state.wallets.map((wallet) => mapWalletFromState(this.state, wallet.id));
  }

  async createFxQuote(quote: FxQuoteView): Promise<void> {
    this.state.fxQuotes.push(structuredClone(quote));
  }

  async listFxConversions(
    page: number,
    pageSize: number,
  ): Promise<{ items: FxConversionView[]; total: number }> {
    const start = (page - 1) * pageSize;
    return {
      items: structuredClone(this.state.fxConversions.slice(start, start + pageSize)),
      total: this.state.fxConversions.length,
    };
  }

  async listTransfers(
    page: number,
    pageSize: number,
  ): Promise<{ items: TransferView[]; total: number }> {
    const start = (page - 1) * pageSize;
    return {
      items: structuredClone(this.state.transfers.slice(start, start + pageSize)),
      total: this.state.transfers.length,
    };
  }

  async listSettlements(
    page: number,
    pageSize: number,
  ): Promise<{ items: SettlementView[]; total: number }> {
    const start = (page - 1) * pageSize;
    return {
      items: structuredClone(this.state.settlements.slice(start, start + pageSize)),
      total: this.state.settlements.length,
    };
  }

  async listWalletFundings(
    page: number,
    pageSize: number,
  ): Promise<{ items: WalletFundingView[]; total: number }> {
    const start = (page - 1) * pageSize;
    return {
      items: structuredClone(this.state.walletFundings.slice(start, start + pageSize)),
      total: this.state.walletFundings.length,
    };
  }

  async findJournal(id: string): Promise<JournalView | undefined> {
    const journal = this.state.journals.find((item) => item.id === id);
    return journal ? structuredClone(journal) : undefined;
  }
}

function createUnitOfWork(state: LedgerState, idempotencyLocks: string[]): LedgerUnitOfWork {
  return {
    async lockIdempotencyKey(key) {
      idempotencyLocks.push(key);
    },
    async findAccount(id) {
      return state.accounts.find((account) => account.id === id);
    },
    async findWallet(id) {
      if (!state.wallets.some((wallet) => wallet.id === id)) return undefined;
      return mapWalletFromState(state, id);
    },
    async findWalletBalanceAccount(walletId, currency) {
      const link = state.walletBalances.find(
        (candidate) => candidate.walletId === walletId && candidate.currency === currency,
      );
      return link ? state.accounts.find((account) => account.id === link.accountId) : undefined;
    },
    async findTransfer(id) {
      return state.transfers.find((transfer) => transfer.id === id);
    },
    async findWalletFunding(id) {
      return state.walletFundings.find((funding) => funding.id === id);
    },
    async findFxQuote(id) {
      return state.fxQuotes.find((quote) => quote.id === id);
    },
    async findFxConversion(id) {
      return state.fxConversions.find((conversion) => conversion.id === id);
    },
    async findPlatformCashAccount(currency) {
      return state.accounts.find(
        (account) => account.type === 'ASSET' && account.currency === currency,
      );
    },
    async findJournal(id) {
      return state.journals.find((journal) => journal.id === id);
    },
    async findIdempotency(key) {
      return state.idempotency.find((item) => item.key === key);
    },
    async createTransfer(aggregate: CreateTransferAggregate) {
      adjustBalance(
        state.accounts,
        aggregate.transfer.sourceAccountId,
        -aggregate.transfer.amountMinor,
      );
      adjustBalance(
        state.accounts,
        aggregate.transfer.destinationAccountId,
        aggregate.transfer.amountMinor,
      );
      state.transfers.push(structuredClone(aggregate.transfer));
      state.journals.push(structuredClone(aggregate.journal));
      state.idempotency.push(structuredClone(aggregate.idempotency));
      state.outbox.push(structuredClone(aggregate.outbox));
    },
    async createWalletBalance(record: CreateWalletBalanceRecord) {
      if (
        state.walletBalances.some(
          (balance) => balance.walletId === record.walletId && balance.currency === record.currency,
        )
      ) {
        throw new Error('Wallet currency balance already exists');
      }
      state.accounts.push(structuredClone(record.account));
      state.walletBalances.push({
        walletId: record.walletId,
        currency: record.currency,
        accountId: record.account.id,
      });
    },
    async createWalletFunding(aggregate: CreateWalletFundingAggregate) {
      adjustBalance(
        state.accounts,
        aggregate.funding.fundingAccountId,
        aggregate.funding.amountMinor,
      );
      adjustBalance(
        state.accounts,
        aggregate.funding.walletAccountId,
        aggregate.funding.amountMinor,
      );
      state.walletFundings.unshift(structuredClone(aggregate.funding));
      state.journals.push(structuredClone(aggregate.journal));
      state.idempotency.push(structuredClone(aggregate.idempotency));
    },
    async createFxConversion(aggregate: CreateFxConversionAggregate) {
      adjustBalance(
        state.accounts,
        aggregate.conversion.sourceAccountId,
        -aggregate.conversion.sourceAmountMinor,
      );
      adjustBalance(
        state.accounts,
        aggregate.sourceCashAccountId,
        -aggregate.conversion.sourceAmountMinor,
      );
      adjustBalance(
        state.accounts,
        aggregate.destinationCashAccountId,
        aggregate.conversion.destinationAmountMinor,
      );
      adjustBalance(
        state.accounts,
        aggregate.conversion.destinationAccountId,
        aggregate.conversion.destinationAmountMinor,
      );
      state.fxConversions.unshift(structuredClone(aggregate.conversion));
      state.journals.push(structuredClone(aggregate.journal));
      state.idempotency.push(structuredClone(aggregate.idempotency));
    },
    async reverseTransfer(aggregate: ReverseTransferAggregate) {
      adjustBalance(
        state.accounts,
        aggregate.transfer.sourceAccountId,
        aggregate.transfer.amountMinor,
      );
      adjustBalance(
        state.accounts,
        aggregate.transfer.destinationAccountId,
        -aggregate.transfer.amountMinor,
      );
      const index = state.transfers.findIndex((item) => item.id === aggregate.transfer.id);
      if (index < 0) throw new Error('Transfer missing during reversal');
      state.transfers[index] = structuredClone(aggregate.transfer);
      state.journals.push(structuredClone(aggregate.journal));
      state.idempotency.push(structuredClone(aggregate.idempotency));
    },
  };
}

function inferWallets(accounts: AccountView[]): {
  wallets: LedgerState['wallets'];
  walletBalances: LedgerState['walletBalances'];
} {
  const wallets = new Map<string, { id: string; ownerName: string }>();
  const walletBalances: LedgerState['walletBalances'][number][] = [];
  for (const account of accounts.filter((candidate) => candidate.type === 'LIABILITY')) {
    const ownerName = account.name.split(' ')[0] ?? account.name;
    const walletId = `wallet-${ownerName.toLowerCase()}`;
    wallets.set(walletId, { id: walletId, ownerName });
    walletBalances.push({ walletId, currency: account.currency, accountId: account.id });
  }
  return { wallets: [...wallets.values()], walletBalances };
}

function mapWalletFromState(state: LedgerState, walletId: string): WalletView {
  const wallet = state.wallets.find((candidate) => candidate.id === walletId);
  if (!wallet) throw new Error('Wallet missing');
  return {
    id: wallet.id,
    ownerName: wallet.ownerName,
    balances: state.walletBalances
      .filter((balance) => balance.walletId === walletId)
      .map((balance) => {
        const account = state.accounts.find((candidate) => candidate.id === balance.accountId);
        if (!account) throw new Error('Wallet balance account missing');
        return { currency: balance.currency, balanceMinor: account.balanceMinor };
      }),
  };
}

function adjustBalance(accounts: AccountView[], accountId: string, deltaMinor: number): void {
  const index = accounts.findIndex((account) => account.id === accountId);
  const account = accounts[index];
  if (index < 0 || !account) throw new Error('Account missing during balance update');
  accounts[index] = { ...account, balanceMinor: account.balanceMinor + deltaMinor };
}
