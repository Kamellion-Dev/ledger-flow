import { useEffect, useState, type FormEvent } from 'react';
import { CirclePlus, CheckCircle2 } from 'lucide-react';
import type { Currency, WalletView } from '@ledgerflow/contracts';

const supportedCurrencies: Currency[] = ['USD', 'EUR', 'GBP', 'EGP'];
export interface WalletBalanceCreationInput {
  walletId: string;
  currency: Currency;
}

export function WalletBalanceCreationForm({
  wallets,
  onSubmit,
}: {
  wallets: WalletView[];
  onSubmit?: (input: WalletBalanceCreationInput) => Promise<void>;
}) {
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);
  const missing = supportedCurrencies.filter(
    (currency) => !selectedWallet?.balances.some((balance) => balance.currency === currency),
  );
  const [currency, setCurrency] = useState<Currency>(missing[0] ?? 'USD');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (missing.length > 0 && !missing.includes(currency)) setCurrency(missing[0]!);
  }, [currency, missing]);

  function changeWallet(nextId: string) {
    const next = wallets.find((wallet) => wallet.id === nextId);
    const nextMissing = supportedCurrencies.filter(
      (item) => !next?.balances.some((balance) => balance.currency === item),
    );
    setWalletId(nextId);
    setCurrency(nextMissing[0] ?? 'USD');
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletId || missing.length === 0) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (!onSubmit) throw new Error('Balance creation service is unavailable.');
      await onSubmit({ walletId, currency });
      setSuccess(`${currency} balance created for ${selectedWallet?.ownerName ?? 'customer'}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the balance.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="wallet-funding-form balance-creation-form"
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <div className="form-row two-columns">
        <label htmlFor="balance-wallet">
          <span>Customer account</span>
          <select
            id="balance-wallet"
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
        <label htmlFor="new-currency">
          <span>New currency</span>
          <select
            id="new-currency"
            aria-label="New currency"
            value={missing.includes(currency) ? currency : ''}
            disabled={missing.length === 0}
            onChange={(e) => {
              setCurrency(e.target.value as Currency);
              setError('');
              setSuccess('');
            }}
          >
            {missing.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      {missing.length === 0 ? (
        <p className="form-guidance">This customer already has every supported currency balance.</p>
      ) : (
        <p className="form-guidance">
          Creates a zero-balance liability pocket under the same customer account.
        </p>
      )}
      <button
        className="secondary-command-button"
        type="submit"
        disabled={submitting || missing.length === 0}
      >
        <CirclePlus aria-hidden="true" />{' '}
        {submitting ? 'Creating balance…' : 'Create currency balance'}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {success && !error ? (
        <p className="form-success" role="status">
          <CheckCircle2 aria-hidden="true" /> {success}
        </p>
      ) : null}
    </form>
  );
}
