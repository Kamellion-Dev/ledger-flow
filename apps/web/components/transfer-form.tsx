import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Currency, TransferView, WalletView } from '@ledgerflow/contracts';
import { formatMoney, parseMoneyInputToMinor } from '../lib/format';

export interface TransferInput {
  sourceWalletId: string;
  destinationWalletId: string;
  amountMinor: number;
  currency: Currency;
  reference: string;
}

interface TransferFormProps {
  wallets: WalletView[];
  onSubmit?: (input: TransferInput, idempotencyKey: string) => Promise<TransferView>;
}

function preferredCurrency(source: WalletView | undefined, wallets: WalletView[]): Currency {
  return (
    source?.balances.find((balance) =>
      wallets.some(
        (wallet) =>
          wallet.id !== source.id &&
          wallet.balances.some((candidate) => candidate.currency === balance.currency),
      ),
    )?.currency ??
    source?.balances[0]?.currency ??
    'USD'
  );
}

export function TransferForm({ wallets, onSubmit }: TransferFormProps) {
  const firstSource = wallets[0];
  const firstCurrency = preferredCurrency(firstSource, wallets);
  const initialDestinations = wallets.filter(
    (wallet) =>
      wallet.id !== firstSource?.id && wallet.balances.some((b) => b.currency === firstCurrency),
  );
  const [sourceId, setSourceId] = useState(firstSource?.id ?? '');
  const [currency, setCurrency] = useState<Currency>(firstCurrency);
  const [destinationId, setDestinationId] = useState(initialDestinations[0]?.id ?? '');
  const [amount, setAmount] = useState('25.00');
  const [reference, setReference] = useState('Dinner split');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<TransferView>();
  const submissionInFlight = useRef(false);
  const idempotencyKey = useRef(globalThis.crypto.randomUUID());

  const source = wallets.find((wallet) => wallet.id === sourceId);
  const balances = source?.balances ?? [];
  const selectedBalance = balances.find((balance) => balance.currency === currency);
  const destinations = wallets.filter(
    (wallet) =>
      wallet.id !== sourceId && wallet.balances.some((balance) => balance.currency === currency),
  );

  function resetIntent() {
    idempotencyKey.current = globalThis.crypto.randomUUID();
    setError('');
    setCreated(undefined);
  }

  function changeSource(nextSourceId: string) {
    resetIntent();
    const nextSource = wallets.find((wallet) => wallet.id === nextSourceId);
    const nextCurrency = preferredCurrency(nextSource, wallets);
    const nextDestination = wallets.find(
      (wallet) =>
        wallet.id !== nextSourceId && wallet.balances.some((b) => b.currency === nextCurrency),
    );
    setSourceId(nextSourceId);
    setCurrency(nextCurrency);
    setDestinationId(nextDestination?.id ?? '');
  }

  function changeCurrency(nextCurrency: Currency) {
    resetIntent();
    const nextDestination = wallets.find(
      (wallet) =>
        wallet.id !== sourceId && wallet.balances.some((b) => b.currency === nextCurrency),
    );
    setCurrency(nextCurrency);
    setDestinationId(nextDestination?.id ?? '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    let amountMinor: number;
    try {
      amountMinor = parseMoneyInputToMinor(amount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enter a valid amount.');
      return;
    }
    if (amountMinor <= 0) {
      setError('Enter a positive amount greater than zero.');
      return;
    }
    if (!sourceId || !destinationId) {
      setError(`No other customer has a ${currency} balance.`);
      return;
    }
    submissionInFlight.current = true;
    setSubmitting(true);
    setError('');
    setCreated(undefined);
    try {
      if (!onSubmit) throw new Error('Transfer service is unavailable.');
      setCreated(
        await onSubmit(
          {
            sourceWalletId: sourceId,
            destinationWalletId: destinationId,
            amountMinor,
            currency,
            reference,
          },
          idempotencyKey.current,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the transfer.');
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      className="transfer-form"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <div className="form-row three-columns">
        <label htmlFor="source-account">
          <span>From account</span>
          <select
            id="source-account"
            aria-label="From account"
            value={sourceId}
            onChange={(e) => changeSource(e.target.value)}
          >
            {wallets.map((wallet) => (
              <option value={wallet.id} key={wallet.id}>
                {wallet.ownerName}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="source-currency">
          <span>Wallet currency</span>
          <select
            id="source-currency"
            aria-label="Wallet currency"
            value={currency}
            onChange={(e) => changeCurrency(e.target.value as Currency)}
          >
            {balances.map((balance) => (
              <option value={balance.currency} key={balance.currency}>
                {balance.currency} · {formatMoney(balance.balanceMinor, balance.currency)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="destination-account">
          <span>To account</span>
          <select
            id="destination-account"
            aria-label="To account"
            value={destinationId}
            disabled={destinations.length === 0}
            onChange={(e) => {
              resetIntent();
              setDestinationId(e.target.value);
            }}
          >
            {destinations.map((wallet) => {
              const balance = wallet.balances.find((item) => item.currency === currency)!;
              return (
                <option value={wallet.id} key={wallet.id}>
                  {wallet.ownerName} · {formatMoney(balance.balanceMinor, currency)}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="transfer-direction" aria-hidden="true">
        <ArrowRight />
      </div>
      <div className="form-row two-columns">
        <label htmlFor="transfer-amount">
          <span>Amount</span>
          <div className="money-input">
            <span>{currency}</span>
            <input
              id="transfer-amount"
              aria-label="Amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                resetIntent();
                setAmount(e.target.value);
              }}
            />
            <span>{currency}</span>
          </div>
        </label>
        <label htmlFor="transfer-reference">
          <span>Reference</span>
          <input
            id="transfer-reference"
            aria-label="Reference"
            value={reference}
            maxLength={140}
            onChange={(e) => {
              resetIntent();
              setReference(e.target.value);
            }}
          />
        </label>
      </div>
      {!destinationId ? (
        <p className="form-guidance">
          No other customer has a {currency} balance. Create one in Ledger first.
        </p>
      ) : null}
      <button
        className="primary-button"
        type="submit"
        disabled={submitting || !destinationId || !selectedBalance}
      >
        {submitting ? 'Creating transfer…' : 'Create transfer'} <ArrowRight aria-hidden="true" />
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {created && !error ? (
        <p className="form-success" role="status">
          <ShieldCheck aria-hidden="true" /> Transfer {created.id} created with status{' '}
          {created.status}.
        </p>
      ) : null}
      <p className="form-footnote">
        Repeated submissions reuse one idempotency key until the transfer details change.
      </p>
    </form>
  );
}
