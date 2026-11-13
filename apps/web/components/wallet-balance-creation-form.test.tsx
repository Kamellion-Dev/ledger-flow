import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WalletView } from '@ledgerflow/contracts';
import { WalletBalanceCreationForm } from './wallet-balance-creation-form';

const wallets: WalletView[] = [
  { id: 'wallet-alice', ownerName: 'Alice', balances: [{ currency: 'USD', balanceMinor: 0 }] },
  {
    id: 'wallet-bob',
    ownerName: 'Bob',
    balances: [
      { currency: 'USD', balanceMinor: 0 },
      { currency: 'EUR', balanceMinor: 0 },
      { currency: 'GBP', balanceMinor: 0 },
      { currency: 'EGP', balanceMinor: 0 },
    ],
  },
];

describe('WalletBalanceCreationForm', () => {
  it('offers every missing supported currency and creates it for the customer', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<WalletBalanceCreationForm wallets={wallets} onSubmit={onSubmit} />);
    const currency = screen.getByRole('combobox', { name: 'New currency' });
    expect(within(currency).queryByRole('option', { name: 'USD' })).not.toBeInTheDocument();
    expect(within(currency).getByRole('option', { name: 'EUR' })).toBeVisible();
    expect(within(currency).getByRole('option', { name: 'GBP' })).toBeVisible();
    expect(within(currency).getByRole('option', { name: 'EGP' })).toBeVisible();
    fireEvent.change(currency, { target: { value: 'EGP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create currency balance' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ walletId: 'wallet-alice', currency: 'EGP' }),
    );
  });

  it('disables creation when the customer already has every supported currency', () => {
    render(<WalletBalanceCreationForm wallets={wallets} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Customer account' }), {
      target: { value: 'wallet-bob' },
    });
    expect(screen.getByRole('button', { name: 'Create currency balance' })).toBeDisabled();
    expect(screen.getByText(/already has every supported currency/)).toBeVisible();
  });

  it('repairs the selected currency after refreshed wallets include the created balance', () => {
    const { rerender } = render(<WalletBalanceCreationForm wallets={wallets} />);
    expect(screen.getByRole('combobox', { name: 'New currency' })).toHaveValue('EUR');

    rerender(
      <WalletBalanceCreationForm
        wallets={[
          {
            ...wallets[0]!,
            balances: [...wallets[0]!.balances, { currency: 'EUR', balanceMinor: 0 }],
          },
          wallets[1]!,
        ]}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'New currency' })).toHaveValue('GBP');
  });

  it('renders API feedback below its button', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Balance already exists'));
    render(<WalletBalanceCreationForm wallets={wallets} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Create currency balance' });
    fireEvent.click(button);
    const alert = await screen.findByRole('alert');
    expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
