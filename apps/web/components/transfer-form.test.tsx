import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TransferView, WalletView } from '@ledgerflow/contracts';
import { TransferForm, type TransferInput } from './transfer-form';

const wallets: WalletView[] = [
  {
    id: 'wallet-alice',
    ownerName: 'Alice',
    balances: [
      { currency: 'USD', balanceMinor: 10_000 },
      { currency: 'EUR', balanceMinor: 7_500 },
    ],
  },
  {
    id: 'wallet-bob',
    ownerName: 'Bob',
    balances: [
      { currency: 'USD', balanceMinor: 5_000 },
      { currency: 'GBP', balanceMinor: 3_000 },
    ],
  },
  { id: 'wallet-carol', ownerName: 'Carol', balances: [{ currency: 'EUR', balanceMinor: 2_500 }] },
];

const createdTransfer: TransferView = {
  id: 'transfer-001',
  idempotencyKey: 'idem-001',
  sourceAccountId: 'alice-usd',
  destinationAccountId: 'bob-usd',
  amountMinor: 2500,
  currency: 'USD',
  reference: 'Dinner split',
  status: 'PENDING',
  journalId: 'journal-001',
  createdAt: '2026-11-13T18:00:00.000Z',
};

describe('TransferForm', () => {
  it('defaults to a transferable currency instead of an isolated first balance', () => {
    const isolatedFirst: WalletView[] = [
      {
        ...wallets[0]!,
        balances: [{ currency: 'EGP', balanceMinor: 1_234 }, ...wallets[0]!.balances],
      },
      ...wallets.slice(1),
    ];
    render(<TransferForm wallets={isolatedFirst} />);

    expect(screen.getByRole('combobox', { name: 'Wallet currency' })).toHaveValue('USD');
    expect(screen.getByRole('combobox', { name: 'To account' })).toHaveValue('wallet-bob');
    expect(screen.getByRole('button', { name: 'Create transfer' })).toBeEnabled();
  });

  it('shows only other customers that own the selected currency', () => {
    render(<TransferForm wallets={wallets} />);
    const destination = screen.getByRole('combobox', { name: 'To account' });
    expect(within(destination).getByRole('option', { name: /Bob/ })).toBeVisible();
    expect(within(destination).queryByRole('option', { name: /Alice/ })).not.toBeInTheDocument();
    expect(within(destination).queryByRole('option', { name: /Carol/ })).not.toBeInTheDocument();
  });

  it('repairs the destination when the selected source currency changes', () => {
    render(<TransferForm wallets={wallets} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Wallet currency' }), {
      target: { value: 'EUR' },
    });
    const destination = screen.getByRole('combobox', { name: 'To account' });
    expect(destination).toHaveValue('wallet-carol');
    expect(within(destination).getByRole('option', { name: /Carol/ })).toBeVisible();
    expect(within(destination).queryByRole('option', { name: /Bob/ })).not.toBeInTheDocument();
    expect(screen.getByText('EUR', { selector: '.money-input span:last-child' })).toBeVisible();
  });

  it('submits wallet identities and the selected currency', async () => {
    const onSubmit = vi.fn().mockResolvedValue(createdTransfer);
    render(<TransferForm wallets={wallets} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create transfer' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      sourceWalletId: 'wallet-alice',
      destinationWalletId: 'wallet-bob',
      amountMinor: 2500,
      currency: 'USD',
      reference: 'Dinner split',
    });
  });

  it('blocks transfer when no other customer owns the selected currency', () => {
    render(<TransferForm wallets={wallets} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'From account' }), {
      target: { value: 'wallet-bob' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Wallet currency' }), {
      target: { value: 'GBP' },
    });
    expect(screen.getByRole('button', { name: 'Create transfer' })).toBeDisabled();
    expect(screen.getByText(/No other customer has a GBP balance/)).toBeVisible();
  });

  it('blocks simultaneous submits and reuses one key while details are unchanged', async () => {
    let finish!: (value: TransferView) => void;
    const onSubmit = vi.fn<(input: TransferInput, key: string) => Promise<TransferView>>(
      () =>
        new Promise<TransferView>((resolve) => {
          finish = resolve;
        }),
    );
    render(<TransferForm wallets={wallets} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Create transfer' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    finish(createdTransfer);
    await screen.findByRole('status');
    fireEvent.click(button);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]?.[1]).toBe(onSubmit.mock.calls[0]?.[1]);
  });

  it('renders API feedback below the submit button', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Transfer rejected'));
    render(<TransferForm wallets={wallets} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Create transfer' });
    fireEvent.click(button);
    const alert = await screen.findByRole('alert');
    expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
