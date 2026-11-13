import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AccountView, FxConversionView, FxQuoteView } from '@ledgerflow/contracts';
import { FxConversionForm } from './fx-conversion-form';

const accounts: AccountView[] = [
  {
    id: 'wallet-usd',
    code: 'W-USD',
    name: 'Alice USD',
    type: 'LIABILITY',
    currency: 'USD',
    balanceMinor: 10_000,
  },
  {
    id: 'wallet-eur',
    code: 'W-EUR',
    name: 'Alice EUR',
    type: 'LIABILITY',
    currency: 'EUR',
    balanceMinor: 0,
  },
  {
    id: 'wallet-usd-2',
    code: 'W2-USD',
    name: 'Bob USD',
    type: 'LIABILITY',
    currency: 'USD',
    balanceMinor: 5_000,
  },
  {
    id: 'cash-usd',
    code: 'C-USD',
    name: 'Cash USD',
    type: 'ASSET',
    currency: 'USD',
    balanceMinor: 15_000,
  },
];

const quote: FxQuoteView = {
  id: 'quote-001',
  provider: 'frankfurter',
  sourceCurrency: 'USD',
  destinationCurrency: 'EUR',
  sourceAmountMinor: 2_500,
  destinationAmountMinor: 2_256,
  rateDecimal: '0.90244',
  rateNumerator: '22561',
  rateDenominator: '25000',
  rateDate: '2026-11-13',
  createdAt: '2026-11-13T20:00:00.000Z',
  expiresAt: '2026-11-13T20:15:00.000Z',
};

const conversion: FxConversionView = {
  id: 'conversion-001',
  idempotencyKey: 'fx-key',
  quoteId: quote.id,
  sourceAccountId: 'wallet-usd',
  destinationAccountId: 'wallet-eur',
  sourceAmountMinor: 2_500,
  destinationAmountMinor: 2_256,
  sourceCurrency: 'USD',
  destinationCurrency: 'EUR',
  rateDecimal: '0.90244',
  journalId: 'journal-001',
  reference: 'Travel money',
  createdAt: '2026-11-13T20:01:00.000Z',
};

describe('FxConversionForm', () => {
  it('requests an exact quote, confirms it once, and invalidates it when inputs change', async () => {
    const onQuote = vi.fn().mockResolvedValue(quote);
    const onConvert = vi.fn().mockResolvedValue(conversion);
    render(<FxConversionForm accounts={accounts} onQuote={onQuote} onConvert={onConvert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Get live quote' }));
    expect(await screen.findByText('1 USD = 0.90244 EUR')).toBeInTheDocument();
    expect(onQuote).toHaveBeenCalledWith({
      sourceCurrency: 'USD',
      destinationCurrency: 'EUR',
      sourceAmountMinor: 2_500,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm conversion' }));
    expect(await screen.findByRole('status')).toHaveTextContent('conversion-001');
    expect(onConvert).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: 'quote-001',
        sourceAccountId: 'wallet-usd',
        destinationAccountId: 'wallet-eur',
      }),
      expect.any(String),
    );

    fireEvent.change(screen.getByLabelText('Source amount'), { target: { value: '26.00' } });
    expect(screen.queryByText('1 USD = 0.90244 EUR')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm conversion' })).not.toBeInTheDocument();
  });

  it('offers only cross-currency liability destinations', () => {
    render(<FxConversionForm accounts={accounts} />);
    const destination = screen.getByRole('combobox', { name: 'Destination wallet' });
    expect(within(destination).getByRole('option', { name: /Alice EUR/ })).toBeVisible();
    expect(within(destination).queryByRole('option', { name: /Bob USD/ })).not.toBeInTheDocument();
    expect(within(destination).queryByRole('option', { name: /Cash USD/ })).not.toBeInTheDocument();
  });

  it('keeps quote errors below the quote button', async () => {
    render(
      <FxConversionForm
        accounts={accounts}
        onQuote={vi.fn().mockRejectedValue(new Error('Rate provider unavailable'))}
      />,
    );
    const button = screen.getByRole('button', { name: 'Get live quote' });
    fireEvent.click(button);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Rate provider unavailable');
    expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(button).toBeEnabled());
  });
});
