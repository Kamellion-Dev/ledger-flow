import { CheckCircle2, Scale } from 'lucide-react';
import { formatMoney } from '../lib/format';

export function JournalBalanceProof({
  postings,
}: {
  postings: Array<{ side: 'DEBIT' | 'CREDIT'; amountMinor: number }>;
}) {
  const debits = postings
    .filter((posting) => posting.side === 'DEBIT')
    .reduce((total, posting) => total + posting.amountMinor, 0);
  const credits = postings
    .filter((posting) => posting.side === 'CREDIT')
    .reduce((total, posting) => total + posting.amountMinor, 0);
  const balanced = debits === credits && debits > 0;
  return (
    <div className={`balance-proof ${balanced ? 'is-balanced' : 'is-unbalanced'}`}>
      <Scale aria-hidden="true" />
      <div>
        <span>Debits</span>
        <strong>{formatMoney(debits)}</strong>
      </div>
      <span className="equals">=</span>
      <div>
        <span>Credits</span>
        <strong>{formatMoney(credits)}</strong>
      </div>
      <span className="balance-result">
        <CheckCircle2 aria-hidden="true" /> {balanced ? 'Balanced' : 'Review'}
      </span>
    </div>
  );
}
