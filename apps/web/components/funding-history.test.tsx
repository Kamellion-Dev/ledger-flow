import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WalletFundingView } from '@ledgerflow/contracts';
import { FundingHistory } from './funding-history';

const funding: WalletFundingView = {
  id: 'funding-001',
  idempotencyKey: 'funding-key-001',
  fundingAccountId: 'platform-cash',
  walletAccountId: 'wallet-alice',
  walletName: 'Alice Wallet',
  amountMinor: 5_000,
  currency: 'USD',
  reference: 'Bank cash-in',
  journalId: 'funding-journal-001',
  createdAt: '2026-11-13T19:00:00.000Z',
};

describe('FundingHistory', () => {
  it('shows funded wallet, reference, amount, and journal identity', () => {
    render(<FundingHistory fundings={[funding]} />);

    expect(screen.getByText('Alice Wallet')).toBeVisible();
    expect(screen.getByText('Bank cash-in')).toBeVisible();
    expect(screen.getByText('+$50.00')).toBeVisible();
    expect(screen.getByText('funding-journal-001')).toBeVisible();
  });
});
