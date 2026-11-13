import { RecentTransfers } from '../../components/recent-transfers';
import { TransferForm } from '../../components/transfer-form';
import { PageState, useLedgerFlow } from '../ledgerflow-provider';

export function TransactionsPage() {
  const { status, error, wallets, transfers, createTransfer } = useLedgerFlow();
  if (status !== 'ready') return <PageState status={status} error={error} />;
  return (
    <div className="split-layout">
      <section className="panel create-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">New command</p>
            <h2>Create a transfer</h2>
          </div>
        </div>
        <TransferForm wallets={wallets} onSubmit={createTransfer} />
      </section>
      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Immutable history</p>
            <h2>Transaction stream</h2>
          </div>
        </div>
        <RecentTransfers transfers={transfers} />
      </section>
    </div>
  );
}
