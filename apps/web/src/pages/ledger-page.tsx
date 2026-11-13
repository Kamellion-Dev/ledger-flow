import { Landmark, ShieldCheck, WalletCards } from 'lucide-react';
import type { Currency } from '@ledgerflow/contracts';
import { FundingHistory } from '../../components/funding-history';
import { WalletBalanceCreationForm } from '../../components/wallet-balance-creation-form';
import { WalletFundingForm } from '../../components/wallet-funding-form';
import { formatMoney } from '../../lib/format';
import { PageState, useLedgerFlow } from '../ledgerflow-provider';

const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'EGP'];

export function LedgerPage() {
  const { status, error, accounts, wallets, fundings, createWalletFunding, createWalletBalance } =
    useLedgerFlow();
  if (status !== 'ready') return <PageState status={status} error={error} />;

  return (
    <>
      <div className="notice-bar funding-notice">
        <ShieldCheck aria-hidden="true" />
        <span>
          One customer account can own multiple currency balances. Each admin action posts against
          the matching currency only.
        </span>
      </div>
      <section className="currency-metrics" aria-label="Balances by currency">
        {currencies.map((currency) => {
          const asset = accounts
            .filter((account) => account.type === 'ASSET' && account.currency === currency)
            .reduce((sum, account) => sum + account.balanceMinor, 0);
          const liability = wallets
            .flatMap((wallet) => wallet.balances)
            .filter((balance) => balance.currency === currency)
            .reduce((sum, balance) => sum + balance.balanceMinor, 0);
          return (
            <article className="currency-metric" key={currency}>
              <div className="currency-metric-heading">
                <strong>{currency}</strong>
                <span>
                  {
                    wallets.filter((wallet) =>
                      wallet.balances.some((balance) => balance.currency === currency),
                    ).length
                  }{' '}
                  customers
                </span>
              </div>
              <div>
                <span>
                  <Landmark aria-hidden="true" /> Platform asset
                </span>
                <strong>{formatMoney(asset, currency)}</strong>
              </div>
              <div>
                <span>
                  <WalletCards aria-hidden="true" /> Wallet liability
                </span>
                <strong>{formatMoney(liability, currency)}</strong>
              </div>
            </article>
          );
        })}
      </section>
      <div className="funding-workspace-grid admin-command-grid">
        <section className="panel funding-command-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Admin account command</p>
              <h2>Create currency balance</h2>
            </div>
            <span className="cash-backed-chip">Zero opening balance</span>
          </div>
          <p className="panel-description">
            Add a missing USD, EUR, GBP, or EGP balance beneath an existing customer account.
          </p>
          <WalletBalanceCreationForm wallets={wallets} onSubmit={createWalletBalance} />
        </section>
        <section className="panel funding-command-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">System funding command</p>
              <h2>Credit a customer wallet</h2>
            </div>
            <span className="cash-backed-chip">Cash backed</span>
          </div>
          <p className="panel-description">
            Top up any existing currency balance with one atomic debit / credit journal.
          </p>
          <WalletFundingForm wallets={wallets} onSubmit={createWalletFunding} />
        </section>
      </div>
      <section className="panel wallet-directory-panel grouped-wallet-directory">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Customer accounts</p>
            <h2>Multi-currency balances</h2>
          </div>
          <span className="history-count">{wallets.length} customers</span>
        </div>
        <div className="wallet-directory">
          {wallets.map((wallet) => (
            <article key={wallet.id}>
              <span className="wallet-avatar">
                {wallet.ownerName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)}
              </span>
              <div className="wallet-owner">
                <strong>{wallet.ownerName}</strong>
                <code>{wallet.id}</code>
              </div>
              <div className="balance-chip-list">
                {wallet.balances.map((balance) => (
                  <span key={balance.currency}>
                    <small>{balance.currency}</small>
                    <strong>{formatMoney(balance.balanceMinor, balance.currency)}</strong>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel funding-history-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Immutable cash-in log</p>
            <h2>Funding history</h2>
          </div>
          <span className="history-count">{fundings.length} posted</span>
        </div>
        <FundingHistory fundings={fundings} />
      </section>
    </>
  );
}
