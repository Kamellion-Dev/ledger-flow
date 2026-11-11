import type { TransferView } from '@ledgerflow/contracts';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
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
              <td className="align-right amount-cell">{formatMoney(transfer.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link className="table-link" href="/transactions">
        View all transactions <ArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}
