import { useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, CheckCircle2, Landmark, WalletCards } from 'lucide-react';
import type { Currency, WalletFundingView, WalletView } from '@ledgerflow/contracts';
import { formatMoney, parseMoneyInputToMinor } from '../lib/format';

export interface WalletFundingInput {
  walletId: string;
  currency: Currency;
  amountMinor: number;
  reference: string;
}
interface Props {
  wallets: WalletView[];
  onSubmit?: (input: WalletFundingInput, key: string) => Promise<WalletFundingView>;
}

export function WalletFundingForm({ wallets, onSubmit }: Props) {
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);
  const [currency, setCurrency] = useState<Currency>(
    selectedWallet?.balances[0]?.currency ?? 'USD',
  );
  const [amount, setAmount] = useState('50.00');
  const [reference, setReference] = useState('Customer cash-in');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<WalletFundingView>();
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const key = useRef(globalThis.crypto.randomUUID());
  let amountMinor = Number.NaN;
  try {
    amountMinor = parseMoneyInputToMinor(amount);
  } catch {
    /* validated on submit */
  }

  function resetIntent() {
    key.current = globalThis.crypto.randomUUID();
    setError('');
    setCreated(undefined);
  }
  function changeWallet(nextId: string) {
    resetIntent();
    const next = wallets.find((wallet) => wallet.id === nextId);
    setWalletId(nextId);
    setCurrency(next?.balances[0]?.currency ?? 'USD');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (!selectedWallet?.balances.some((balance) => balance.currency === currency)) {
      setError('Choose an existing currency balance.');
      return;
    }
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a positive amount greater than zero.');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    setCreated(undefined);
    try {
      if (!onSubmit) throw new Error('Wallet funding service is unavailable.');
      setCreated(await onSubmit({ walletId, currency, amountMinor, reference }, key.current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to credit the balance.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }
  return (
    <form
      className="wallet-funding-form"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <div className="form-row two-columns">
        <label htmlFor="funding-wallet">
          <span>Customer account</span>
          <select
            id="funding-wallet"
            aria-label="Customer account"
            value={walletId}
            onChange={(e) => changeWallet(e.target.value)}
          >
            {wallets.map((wallet) => (
              <option value={wallet.id} key={wallet.id}>
                {wallet.ownerName}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="funding-currency">
          <span>Wallet currency</span>
          <select
            id="funding-currency"
            aria-label="Wallet currency"
            value={currency}
            onChange={(e) => {
              resetIntent();
              setCurrency(e.target.value as Currency);
            }}
          >
            {(selectedWallet?.balances ?? []).map((balance) => (
              <option value={balance.currency} key={balance.currency}>
                {balance.currency} · {formatMoney(balance.balanceMinor, balance.currency)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row two-columns">
        <label htmlFor="funding-amount">
          <span>Credit amount</span>
          <div className="money-input">
            <span>{currency}</span>
            <input
              id="funding-amount"
              aria-label="Credit amount"
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
        <label htmlFor="funding-reference">
          <span>Operator reference</span>
          <input
            id="funding-reference"
            aria-label="Operator reference"
            value={reference}
            maxLength={140}
            onChange={(e) => {
              resetIntent();
              setReference(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="funding-entry-preview" aria-label="Double-entry preview">
        <div>
          <span className="entry-icon entry-debit">
            <Landmark aria-hidden="true" />
          </span>
          <span>
            <small>Debit asset</small>
            <strong>Platform {currency} Cash</strong>
          </span>
          <code>{Number.isFinite(amountMinor) ? formatMoney(amountMinor, currency) : '—'}</code>
        </div>
        <div>
          <span className="entry-icon entry-credit">
            <WalletCards aria-hidden="true" />
          </span>
          <span>
            <small>Credit liability</small>
            <strong>
              {selectedWallet?.ownerName ?? 'Customer'} · {currency}
            </strong>
          </span>
          <code>{Number.isFinite(amountMinor) ? formatMoney(amountMinor, currency) : '—'}</code>
        </div>
      </div>
      <button className="primary-button" type="submit" disabled={submitting || !selectedWallet}>
        <ArrowDownToLine aria-hidden="true" />{' '}
        {submitting ? 'Crediting balance…' : 'Credit balance'}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {created && !error ? (
        <p className="form-success" role="status">
          <CheckCircle2 aria-hidden="true" /> {created.walletName} credited{' '}
          {formatMoney(created.amountMinor, created.currency)} · {created.id}
        </p>
      ) : null}
      <p className="form-footnote">Unchanged retries reuse one idempotency key and post once.</p>
    </form>
  );
}
