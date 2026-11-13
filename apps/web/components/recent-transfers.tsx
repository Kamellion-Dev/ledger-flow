import type { TransferView } from '@ledgerflow/contracts';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTime, formatMoney } from '../lib/format';
import { StatusBadge } from './status-badge';

export function RecentTransfers({ transfers }: { transfers: TransferView[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transfer</th>
            <th>Reference</th>
            <th>Status</th>
            <th>Created</th>
            <th className="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr key={transfer.id}>
              <td className="mono-cell">{transfer.id}</td>
              <td>{transfer.reference}</td>
              <td>
                <StatusBadge status={transfer.status} />
              </td>
              <td>{formatDateTime(transfer.createdAt)}</td>
              <td className="align-right amount-cell">
                {formatMoney(transfer.amountMinor, transfer.currency)}
              </td>
            </tr>
          ))}
          {transfers.length === 0 ? (
            <tr>
              <td colSpan={5}>No transfers have been created yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Link className="table-link" to="/transactions">
        View all transactions <ArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}
