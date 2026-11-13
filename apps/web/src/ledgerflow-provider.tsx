import type {
  AccountView,
  DashboardSummary,
  JournalView,
  SettlementView,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LedgerFlowApiPort, NewWalletBalance, NewTransfer } from '../lib/api-client';
import type { TransferInput } from '../components/transfer-form';
import type { WalletFundingInput } from '../components/wallet-funding-form';
import type { WalletBalanceCreationInput } from '../components/wallet-balance-creation-form';

interface LedgerFlowState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  summary?: DashboardSummary;
  accounts: AccountView[];
  wallets: WalletView[];
  transfers: TransferView[];
  settlements: SettlementView[];
  fundings: WalletFundingView[];
  journal?: JournalView;
}

interface LedgerFlowContextValue extends LedgerFlowState {
  refresh: () => Promise<void>;
  createTransfer: (input: TransferInput, idempotencyKey: string) => Promise<TransferView>;
  createWalletFunding: (
    input: WalletFundingInput,
    idempotencyKey: string,
  ) => Promise<WalletFundingView>;
  createWalletBalance: (input: WalletBalanceCreationInput) => Promise<void>;
}

const initialState: LedgerFlowState = {
  status: 'loading',
  accounts: [],
  wallets: [],
  transfers: [],
  settlements: [],
  fundings: [],
};

const LedgerFlowContext = createContext<LedgerFlowContextValue | undefined>(undefined);

export function LedgerFlowProvider({
  api,
  children,
}: {
  api: LedgerFlowApiPort;
  children: ReactNode;
}) {
  const [state, setState] = useState<LedgerFlowState>(initialState);

  const refresh = useCallback(async () => {
    try {
      const [summary, accounts, wallets, transfersPage, settlementsPage, fundingsPage] =
        await Promise.all([
          api.getSummary(),
          api.listAccounts(),
          api.listWallets(),
          api.listTransfers(),
          api.listSettlements(),
          api.listWalletFundings(),
        ]);
      const latest = transfersPage.items[0];
      const journal = latest ? await api.getJournal(latest.journalId) : undefined;
      setState({
        status: 'ready',
        summary,
        accounts,
        wallets,
        transfers: transfersPage.items,
        settlements: settlementsPage.items,
        fundings: fundingsPage.items,
        ...(journal ? { journal } : {}),
      });
    } catch (caught) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: caught instanceof Error ? caught.message : 'Unable to connect to LedgerFlow.',
      }));
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTransfer = useCallback(
    async (input: TransferInput, idempotencyKey: string) => {
      const command: NewTransfer = input;
      const transfer = await api.createTransfer(command, idempotencyKey);
      await refresh();
      return transfer;
    },
    [api, refresh],
  );

  const createWalletFunding = useCallback(
    async (input: WalletFundingInput, idempotencyKey: string) => {
      const funding = await api.createWalletFunding(input, idempotencyKey);
      await refresh();
      return funding;
    },
    [api, refresh],
  );

  const createWalletBalance = useCallback(
    async (input: WalletBalanceCreationInput) => {
      const command: NewWalletBalance = input;
      await api.createWalletBalance(command);
      await refresh();
    },
    [api, refresh],
  );

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      createTransfer,
      createWalletFunding,
      createWalletBalance,
    }),
    [createTransfer, createWalletFunding, createWalletBalance, refresh, state],
  );

  return <LedgerFlowContext.Provider value={value}>{children}</LedgerFlowContext.Provider>;
}

export function useLedgerFlow(): LedgerFlowContextValue {
  const value = useContext(LedgerFlowContext);
  if (!value) throw new Error('useLedgerFlow must be used inside LedgerFlowProvider');
  return value;
}

export function PageState({
  status,
  error,
}: {
  status: LedgerFlowState['status'];
  error: string | undefined;
}) {
  if (status === 'loading') {
    return <section className="panel state-panel">Connecting to the NestJS API…</section>;
  }
  if (status === 'error') {
    return (
      <section className="panel state-panel form-error" role="alert">
        {error ?? 'Unable to connect to LedgerFlow.'}
      </section>
    );
  }
  return null;
}
