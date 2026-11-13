import { RotateCw } from 'lucide-react';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime } from '../../lib/format';
import { PageState, useLedgerFlow } from '../ledgerflow-provider';

export function SettlementsPage() {
  const { status, error, settlements } = useLedgerFlow();
  if (status !== 'ready') return <PageState status={status} error={error} />;
  return (
    <section className="panel activity-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">RabbitMQ consumer</p>
          <h2>Settlement queue</h2>
        </div>
        <div className="id-chip">
          <RotateCw aria-hidden="true" /> Manual acknowledgements
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Settlement</th>
              <th>Transfer</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement) => (
              <tr key={settlement.id}>
                <td className="mono-cell">{settlement.id}</td>
                <td className="mono-cell">{settlement.transferId}</td>
                <td>
                  <StatusBadge status={settlement.status} />
                </td>
                <td>{settlement.attemptCount}</td>
                <td>
                  {settlement.completedAt
                    ? formatDateTime(settlement.completedAt)
                    : 'Awaiting worker'}
                </td>
              </tr>
            ))}
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={5}>No settlement events have been processed yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
