import { DashboardOverview } from '../components/dashboard-overview';
import { demoSummary } from '../lib/demo-data';

export default function OverviewPage() {
  return <DashboardOverview summary={demoSummary} />;
}
