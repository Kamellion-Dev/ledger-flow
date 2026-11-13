import { DashboardOverview } from '../../components/dashboard-overview';
import { PageState, useLedgerFlow } from '../ledgerflow-provider';

export function OverviewPage() {
  const { status, error, summary } = useLedgerFlow();
  if (status !== 'ready' || !summary) return <PageState status={status} error={error} />;
  return <DashboardOverview summary={summary} />;
}
