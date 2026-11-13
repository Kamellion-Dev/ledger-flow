import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeftRight, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import type { AccountView, FxConversionView, FxQuoteView } from '@ledgerflow/contracts';
import type { NewFxConversion, NewFxQuote } from '../lib/api-client';
import { formatMoney, parseMoneyInputToMinor } from '../lib/format';

interface FxConversionFormProps {
  accounts: AccountView[];
  onQuote?: (input: NewFxQuote) => Promise<FxQuoteView>;
  onConvert?: (input: NewFxConversion, idempotencyKey: string) => Promise<FxConversionView>;
}

export function FxConversionForm({ accounts, onQuote, onConvert }: FxConversionFormProps) {
  const wallets = useMemo(
    () => accounts.filter((account) => account.type === 'LIABILITY'),
    [accounts],
  );
  const initialSource = wallets.find((wallet) => wallet.balanceMinor > 0) ?? wallets[0];
  const initialDestination = wallets.find((wallet) => wallet.currency !== initialSource?.currency);
  const [sourceId, setSourceId] = useState(initialSource?.id ?? '');
  const [destinationId, setDestinationId] = useState(initialDestination?.id ?? '');
  const [amount, setAmount] = useState('25.00');
  const [reference, setReference] = useState('Travel money');
  const [quote, setQuote] = useState<FxQuoteView>();
  const [created, setCreated] = useState<FxConversionView>();
  const [error, setError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [converting, setConverting] = useState(false);
  const key = useRef(globalThis.crypto.randomUUID());
  const source = wallets.find((wallet) => wallet.id === sourceId);
  const destinations = wallets.filter((wallet) => wallet.currency !== source?.currency);
  const destination = destinations.find((wallet) => wallet.id === destinationId) ?? destinations[0];

  function invalidate(update: () => void) {
    update();
    setQuote(undefined);
    setCreated(undefined);
    setError('');
    key.current = globalThis.crypto.randomUUID();
  }

  async function requestQuote(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCreated(undefined);
    try {
      if (!source || !destination) throw new Error('Choose wallets in two different currencies.');
      const sourceAmountMinor = parseMoneyInputToMinor(amount);
      if (sourceAmountMinor <= 0) throw new Error('Enter a positive amount greater than zero.');
      if (!onQuote) throw new Error('Exchange-rate service is unavailable.');
      setQuoting(true);
      setQuote(
        await onQuote({
          sourceCurrency: source.currency,
          destinationCurrency: destination.currency,
          sourceAmountMinor,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to request a quote.');
    } finally {
      setQuoting(false);
    }
  }

  async function confirm() {
    if (!quote || !source || !destination || converting) return;
    setError('');
    try {
      if (!onConvert) throw new Error('FX conversion service is unavailable.');
      setConverting(true);
      setCreated(
        await onConvert(
          {
            quoteId: quote.id,
            sourceAccountId: source.id,
            destinationAccountId: destination.id,
            reference,
          },
          key.current,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to confirm the conversion.');
    } finally {
      setConverting(false);
    }
  }

  return (
    <form className="fx-form" onSubmit={(event) => void requestQuote(event)} noValidate>
      <div className="form-row two-columns">
        <label>
          <span>Source wallet</span>
          <select
            aria-label="Source wallet"
            value={sourceId}
            onChange={(event) =>
              invalidate(() => {
                setSourceId(event.target.value);
                const next = wallets.find((wallet) => wallet.id === event.target.value);
                setDestinationId(
                  wallets.find((wallet) => wallet.currency !== next?.currency)?.id ?? '',
                );
              })
            }
          >
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} · {formatMoney(wallet.balanceMinor, wallet.currency)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Destination wallet</span>
          <select
            aria-label="Destination wallet"
            value={destination?.id ?? ''}
            onChange={(event) => invalidate(() => setDestinationId(event.target.value))}
          >
            {destinations.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} · {formatMoney(wallet.balanceMinor, wallet.currency)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fx-pair-mark" aria-hidden="true">
        <ArrowLeftRight />
      </div>
      <div className="form-row two-columns">
        <label>
          <span>Source amount</span>
          <div className="money-input">
            <span>{source?.currency ?? '—'}</span>
            <input
              aria-label="Source amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => invalidate(() => setAmount(event.target.value))}
            />
          </div>
        </label>
        <label>
          <span>Reference</span>
          <input
            aria-label="Conversion reference"
            maxLength={140}
            value={reference}
            onChange={(event) => invalidate(() => setReference(event.target.value))}
          />
        </label>
      </div>
      <button className="secondary-button" type="submit" disabled={quoting || !destination}>
        {quoting ? <RefreshCw className="spin" /> : <Clock3 />}{' '}
        {quoting ? 'Fetching reference rate…' : 'Get live quote'}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {quote ? (
        <section className="fx-quote" aria-label="FX quote">
          <div>
            <small>Frankfurter reference rate · {quote.rateDate}</small>
            <strong>
              1 {quote.sourceCurrency} = {quote.rateDecimal} {quote.destinationCurrency}
            </strong>
          </div>
          <div className="fx-quote-amount">
            <span>{formatMoney(quote.sourceAmountMinor, quote.sourceCurrency)}</span>
            <ArrowLeftRight />
            <strong>{formatMoney(quote.destinationAmountMinor, quote.destinationCurrency)}</strong>
          </div>
          <p>
            Quote snapshot expires{' '}
            {new Date(quote.expiresAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            .
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void confirm()}
            disabled={converting}
          >
            {converting ? 'Posting four-account journal…' : 'Confirm conversion'}
          </button>
        </section>
      ) : null}
      {created && !error ? (
        <p className="form-success" role="status">
          <CheckCircle2 /> Conversion {created.id} posted once.
        </p>
      ) : null}
      <p className="form-footnote">
        Rates are reference data, not executable market prices. Confirmation posts two independently
        balanced currency legs.
      </p>
    </form>
  );
}
