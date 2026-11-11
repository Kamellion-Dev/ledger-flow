import { ArrowDownLeft, ArrowUpRight, Fingerprint } from 'lucide-react';
import { JournalBalanceProof } from '../../components/journal-balance-proof';
import { demoJournal } from '../../lib/demo-data';
import { formatDateTime, formatMoney } from '../../lib/format';

export default function LedgerPage() {
  return (
    <section className="panel journal-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Journal explorer</p>
          <h2>{demoJournal.reference}</h2>
        </div>
        <div className="id-chip">
          <Fingerprint aria-hidden="true" /> {demoJournal.id}
        </div>
      </div>
      <div className="journal-meta">
        <span>Posted {formatDateTime(demoJournal.createdAt)}</span>
        <span>Transfer {demoJournal.transferId}</span>
        <span>Currency {demoJournal.currency}</span>
      </div>
      <div className="posting-list">
        {demoJournal.postings.map((posting) => (
          <article className="posting-row" key={posting.id}>
            <span className={`posting-icon side-${posting.side.toLowerCase()}`}>
              {posting.side === 'DEBIT' ? (
                <ArrowDownLeft aria-hidden="true" />
              ) : (
                <ArrowUpRight aria-hidden="true" />
              )}
            </span>
            <div>
              <strong>{posting.accountName}</strong>
              <code>{posting.accountCode}</code>
            </div>
            <span className="posting-side">{posting.side}</span>
            <strong className="posting-amount">{formatMoney(posting.amountMinor)}</strong>
          </article>
        ))}
      </div>
      <JournalBalanceProof postings={demoJournal.postings} />
    </section>
  );
}
