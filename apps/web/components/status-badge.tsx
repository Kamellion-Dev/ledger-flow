import type { SettlementStatus, TransferStatus } from '@ledgerflow/contracts';
import { CheckCircle2, Clock3, RotateCcw, XCircle } from 'lucide-react';

export function StatusBadge({ status }: { status: TransferStatus | SettlementStatus }) {
  const icon =
    status === 'SETTLED' ? (
      <CheckCircle2 aria-hidden="true" />
    ) : status === 'PENDING' ? (
      <Clock3 aria-hidden="true" />
    ) : status === 'REVERSED' ? (
      <RotateCcw aria-hidden="true" />
    ) : (
      <XCircle aria-hidden="true" />
    );
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {icon}
      {status.toLowerCase()}
    </span>
  );
}
