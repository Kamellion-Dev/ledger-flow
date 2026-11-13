import { FileCheck2 } from 'lucide-react';
import type { WalletFundingView } from '@ledgerflow/contracts';
import { formatDateTime, formatMoney } from '../lib/format';

export function FundingHistory({ fundings }: { fundings: WalletFundingView[] }) {
  if (fundings.length === 0) {
    return <div className="empty-funding-state">No wallet funding has been posted yet.</div>;
  }
  return (
    <div className="table-wrap funding-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Reference</th>
            <th>Journal</th>
            <th>Posted</th>
            <th className="align-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {fundings.map((funding) => (
            <tr key={funding.id}>
              <td>
                <strong>{funding.walletName}</strong>
                <code className="sub-id">{funding.id}</code>
              </td>
              <td>{funding.reference}</td>
              <td>
                <span className="journal-reference">
                  <FileCheck2 aria-hidden="true" /> {funding.journalId}
                </span>
              </td>
              <td>{formatDateTime(funding.createdAt)}</td>
              <td className="align-right amount-cell funding-amount">
                +{formatMoney(funding.amountMinor, funding.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
