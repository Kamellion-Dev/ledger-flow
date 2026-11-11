'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export interface TransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  reference: string;
}

export function TransferForm({ onSubmit }: { onSubmit?: (input: TransferInput) => void }) {
  const [source, setSource] = useState('wallet-alice');
  const [destination, setDestination] = useState('wallet-bob');
  const [amount, setAmount] = useState('25.00');
  const [reference, setReference] = useState('Dinner split');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a positive amount greater than zero.');
      return;
    }
    if (source === destination) {
      setError('Choose two different wallet accounts.');
      return;
    }
    setError('');
    onSubmit?.({
      sourceAccountId: source,
      destinationAccountId: destination,
      amountMinor: Math.round(numericAmount * 100),
      reference,
    });
    setSubmitted(true);
  }

  return (
    <form className="transfer-form" onSubmit={submit} noValidate>
      <div className="form-row two-columns">
        <label htmlFor="source-account">
          <span>From account</span>
          <select id="source-account" aria-label="From account" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="wallet-alice">Alice Wallet · $100.00</option>
            <option value="wallet-bob">Bob Wallet · $50.00</option>
          </select>
        </label>
        <label htmlFor="destination-account">
          <span>To account</span>
          <select id="destination-account" aria-label="To account" value={destination} onChange={(event) => setDestination(event.target.value)}>
            <option value="wallet-bob">Bob Wallet · $50.00</option>
            <option value="wallet-alice">Alice Wallet · $100.00</option>
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
            <span>$</span>
            <input
              id="transfer-amount"
              aria-label="Amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span>USD</span>
          </div>
        </label>
        <label htmlFor="transfer-reference">
          <span>Reference</span>
          <input id="transfer-reference" aria-label="Reference" value={reference} maxLength={140} onChange={(event) => setReference(event.target.value)} />
        </label>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {submitted && !error ? (
        <p className="form-success" role="status">
          <ShieldCheck aria-hidden="true" /> Demo transfer validated. Connect the local API to post it.
        </p>
      ) : null}
      <button className="primary-button" type="submit">
        Create transfer <ArrowRight aria-hidden="true" />
      </button>
      <p className="form-footnote">A unique idempotency key is created for every submission.</p>
    </form>
  );
}
