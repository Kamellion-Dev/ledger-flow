import type {
  AccountView,
  JournalView,
  SettlementView,
  TransferView,
} from '@ledgerflow/contracts';
import type {
  CreateTransferAggregate,
  LedgerRepository,
  LedgerState,
  LedgerUnitOfWork,
  ReverseTransferAggregate,
} from '../src/ledger/ledger-repository.js';

export class InMemoryLedgerRepository implements LedgerRepository {
  private state: LedgerState;

  constructor(accounts: AccountView[]) {
    this.state = {
      accounts: structuredClone(accounts),
      transfers: [],
      journals: [],
      settlements: [],
      idempotency: [],
      outbox: [],
      processedEventIds: [],
    };
  }

  inspect(): LedgerState {
    return structuredClone(this.state);
  }

  async transaction<T>(work: (unitOfWork: LedgerUnitOfWork) => Promise<T>): Promise<T> {
    const draft = structuredClone(this.state);
    const unitOfWork = createUnitOfWork(draft);
    const result = await work(unitOfWork);
    this.state = draft;
    return result;
  }

  async listAccounts(): Promise<AccountView[]> {
    return structuredClone(this.state.accounts);
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

  async findJournal(id: string): Promise<JournalView | undefined> {
    const journal = this.state.journals.find((item) => item.id === id);
    return journal ? structuredClone(journal) : undefined;
  }
}

function createUnitOfWork(state: LedgerState): LedgerUnitOfWork {
  return {
    async findAccount(id) {
      return state.accounts.find((account) => account.id === id);
    },
    async findTransfer(id) {
      return state.transfers.find((transfer) => transfer.id === id);
    },
    async findJournal(id) {
      return state.journals.find((journal) => journal.id === id);
    },
    async findIdempotency(key) {
      return state.idempotency.find((item) => item.key === key);
    },
    async createTransfer(aggregate: CreateTransferAggregate) {
      replaceBalance(state.accounts, aggregate.transfer.sourceAccountId, aggregate.sourceBalanceMinor);
      replaceBalance(
        state.accounts,
        aggregate.transfer.destinationAccountId,
        aggregate.destinationBalanceMinor,
      );
      state.transfers.push(structuredClone(aggregate.transfer));
      state.journals.push(structuredClone(aggregate.journal));
      state.idempotency.push(structuredClone(aggregate.idempotency));
      state.outbox.push(structuredClone(aggregate.outbox));
    },
    async reverseTransfer(aggregate: ReverseTransferAggregate) {
      replaceBalance(state.accounts, aggregate.transfer.sourceAccountId, aggregate.sourceBalanceMinor);
      replaceBalance(
        state.accounts,
        aggregate.transfer.destinationAccountId,
        aggregate.destinationBalanceMinor,
      );
      const index = state.transfers.findIndex((item) => item.id === aggregate.transfer.id);
      if (index < 0) throw new Error('Transfer missing during reversal');
      state.transfers[index] = structuredClone(aggregate.transfer);
      state.journals.push(structuredClone(aggregate.journal));
      state.idempotency.push(structuredClone(aggregate.idempotency));
    },
  };
}

function replaceBalance(accounts: AccountView[], accountId: string, balanceMinor: number): void {
  const index = accounts.findIndex((account) => account.id === accountId);
  const account = accounts[index];
  if (index < 0 || !account) throw new Error('Account missing during balance update');
  accounts[index] = { ...account, balanceMinor };
}
