import { RecentTransfers } from '../../components/recent-transfers';
import { TransferForm } from '../../components/transfer-form';
import { demoTransfers } from '../../lib/demo-data';

export default function TransactionsPage() {
  return (
    <div className="split-layout">
      <section className="panel create-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">New command</p>
            <h2>Create a transfer</h2>
          </div>
        </div>
        <TransferForm />
      </section>
      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Immutable history</p>
            <h2>Transaction stream</h2>
          </div>
        </div>
        <RecentTransfers transfers={demoTransfers} />
      </section>
    </div>
  );
}
