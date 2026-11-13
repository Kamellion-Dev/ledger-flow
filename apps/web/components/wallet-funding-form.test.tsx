import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WalletFundingView, WalletView } from '@ledgerflow/contracts';
import { WalletFundingForm, type WalletFundingInput } from './wallet-funding-form';

const wallets: WalletView[] = [
  {
    id: 'wallet-alice',
    ownerName: 'Alice',
    balances: [
      { currency: 'USD', balanceMinor: 10_000 },
      { currency: 'EUR', balanceMinor: 7_500 },
    ],
  },
  { id: 'wallet-bob', ownerName: 'Bob', balances: [{ currency: 'GBP', balanceMinor: 5_000 }] },
];
const funding: WalletFundingView = {
  id: 'funding-001',
  idempotencyKey: 'funding-key-001',
  fundingAccountId: 'platform-eur',
  walletAccountId: 'alice-eur',
  walletName: 'Alice',
  amountMinor: 5_000,
  currency: 'EUR',
  reference: 'Customer cash-in',
  journalId: 'funding-journal-001',
  createdAt: '2026-11-13T19:00:00.000Z',
};

describe('WalletFundingForm', () => {
  it('lets the admin top up any existing customer currency balance', async () => {
    const onSubmit = vi.fn().mockResolvedValue(funding);
    render(<WalletFundingForm wallets={wallets} onSubmit={onSubmit} />);
    const currency = screen.getByRole('combobox', { name: 'Wallet currency' });
    expect(within(currency).getByRole('option', { name: /USD.*\$100\.00/ })).toBeVisible();
    expect(within(currency).getByRole('option', { name: /EUR.*€75\.00/ })).toBeVisible();
    fireEvent.change(currency, { target: { value: 'EUR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Credit balance' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      walletId: 'wallet-alice',
      currency: 'EUR',
      amountMinor: 5000,
      reference: 'Customer cash-in',
    });
  });

  it('repairs currency selection when customer changes', () => {
    render(<WalletFundingForm wallets={wallets} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Customer account' }), {
      target: { value: 'wallet-bob' },
    });
    expect(screen.getByRole('combobox', { name: 'Wallet currency' })).toHaveValue('GBP');
    expect(screen.getByText('GBP', { selector: '.money-input span:last-child' })).toBeVisible();
  });

  it('blocks simultaneous submits and reuses one key while details remain unchanged', async () => {
    let finish!: (value: WalletFundingView) => void;
    const onSubmit = vi.fn<(input: WalletFundingInput, key: string) => Promise<WalletFundingView>>(
      () =>
        new Promise<WalletFundingView>((resolve) => {
          finish = resolve;
        }),
    );
    render(<WalletFundingForm wallets={wallets} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Credit balance' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish({ ...funding, currency: 'USD' });
    await screen.findByRole('status');
    fireEvent.click(button);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]?.[1]).toBe(onSubmit.mock.calls[0]?.[1]);
  });

  it('renders command feedback below the fixed submit button', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Wallet funding rejected'));
    render(<WalletFundingForm wallets={wallets} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Credit balance' });
    fireEvent.click(button);
    const alert = await screen.findByRole('alert');
    expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
