import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  AccountView,
  DashboardSummary,
  FxConversionView,
  FxQuoteView,
  JournalView,
  Page,
  SettlementView,
  TransferView,
  WalletFundingView,
  WalletView,
} from '@ledgerflow/contracts';
import type {
  LedgerFlowApiPort,
  NewFxConversion,
  NewFxQuote,
  NewTransfer,
  NewWalletBalance,
} from '../lib/api-client';
import { App } from './app';

const summary: DashboardSummary = {
  totalVolumeMinor: 12_345,
  settledVolumeMinor: 12_345,
  pendingCount: 0,
  settledCount: 1,
  failedCount: 0,
  accountCount: 2,
  recentTransfers: [],
  volumeByHour: [],
  generatedAt: '2026-11-13T18:00:00.000Z',
};

class FakeApi implements LedgerFlowApiPort {
  createFxQuote(_input: NewFxQuote): Promise<FxQuoteView> {
    return Promise.reject(new Error('Not used'));
  }
  createFxConversion(_input: NewFxConversion, _key: string): Promise<FxConversionView> {
    return Promise.reject(new Error('Not used'));
  }
  listFxConversions(): Promise<Page<FxConversionView>> {
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
  }
  getSummary(): Promise<DashboardSummary> {
    return Promise.resolve(summary);
  }
  listAccounts(): Promise<AccountView[]> {
    return Promise.resolve([]);
  }
  listWallets(): Promise<WalletView[]> {
    return Promise.resolve([]);
  }
  createWalletBalance(_input: NewWalletBalance): Promise<WalletView> {
    return Promise.reject(new Error('Not used'));
  }
  listTransfers(): Promise<Page<TransferView>> {
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
  }
  listSettlements(): Promise<Page<SettlementView>> {
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
  }
  getJournal(_id: string): Promise<JournalView> {
    return Promise.reject(new Error('No journal'));
  }
  createTransfer(_input: NewTransfer, _idempotencyKey: string): Promise<TransferView> {
    return Promise.reject(new Error('Not used'));
  }
  listWalletFundings(): Promise<Page<WalletFundingView>> {
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
  }
  createWalletFunding(): Promise<WalletFundingView> {
    return Promise.reject(new Error('Not used'));
  }
}

describe('App', () => {
  it('navigates between overview and transactions in the browser', async () => {
    window.history.replaceState({}, '', '/');
    render(<App api={new FakeApi()} />);

    expect(screen.getByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('$123.45')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('link', { name: 'Transactions' })[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Transactions', level: 1 }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transactions');
    expect(await screen.findByText('No transfers have been created yet.')).toBeInTheDocument();
  });

  it('presents Ledger as a wallet-funding workspace', async () => {
    window.history.replaceState({}, '', '/ledger');
    render(<App api={new FakeApi()} />);

    expect(await screen.findByRole('heading', { name: 'Ledger', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Credit a customer wallet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Funding history' })).toBeInTheDocument();
  });

  it('removes Exchange from routing and navigation', async () => {
    window.history.replaceState({}, '', '/exchange');
    render(<App api={new FakeApi()} />);

    expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Exchange' })).not.toBeInTheDocument();
  });
});
