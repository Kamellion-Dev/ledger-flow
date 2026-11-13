import type { FxConversionView } from '@ledgerflow/contracts';
import { formatDateTime, formatMoney } from '../lib/format';

export function FxConversionHistory({ conversions }: { conversions: FxConversionView[] }) {
  if (!conversions.length)
    return <p className="empty-funding-state">No currency conversions have been posted yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Pair</th>
            <th>Source</th>
            <th>Destination</th>
            <th>Rate</th>
            <th>Posted</th>
          </tr>
        </thead>
        <tbody>
          {conversions.map((item) => (
            <tr key={item.id}>
              <td>
                {item.reference}
                <small className="sub-id">{item.id}</small>
              </td>
              <td>
                <code>
                  {item.sourceCurrency}/{item.destinationCurrency}
                </code>
              </td>
              <td>{formatMoney(item.sourceAmountMinor, item.sourceCurrency)}</td>
              <td className="funding-amount">
                +{formatMoney(item.destinationAmountMinor, item.destinationCurrency)}
              </td>
              <td>
                <code>{item.rateDecimal}</code>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
