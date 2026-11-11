import type { DashboardSummary } from '@ledgerflow/contracts';
import { Activity, CircleDollarSign, Landmark, Radio } from 'lucide-react';
import { formatMoney } from '../lib/format';
import { AutoRefreshControl } from './auto-refresh-control';
import { MetricCard } from './metric-card';
import { RecentTransfers } from './recent-transfers';
import { VolumeChart } from './volume-chart';

export function DashboardOverview({ summary }: { summary: DashboardSummary }) {
  const successRate = Math.round(
    (summary.settledCount / Math.max(summary.settledCount + summary.failedCount, 1)) * 100,
  );
  return (
    <>
      <div className="notice-bar">
        <Radio aria-hidden="true" />
        <span>
          Sandbox environment. Every balance and transfer uses <strong>simulated funds</strong>.
        </span>
      </div>

      <section className="metric-grid" aria-label="Operational metrics">
        <MetricCard
          label="Processed volume"
          value={formatMoney(summary.totalVolumeMinor)}
          detail="Across the last 24 hours"
          icon={CircleDollarSign}
          tone="positive"
        />
        <MetricCard
          label="Settlement rate"
          value={`${successRate}%`}
          detail={`${summary.settledCount} settled`}
          icon={Landmark}
        />
        <MetricCard
          label="Pending queue"
          value={String(summary.pendingCount)}
          detail="Awaiting worker completion"
          icon={Activity}
          tone="warning"
        />
        <MetricCard
          label="Failed events"
          value={String(summary.failedCount)}
          detail="Needs operator review"
          icon={Radio}
          tone={summary.failedCount > 0 ? 'danger' : 'neutral'}
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Throughput</p>
              <h2>Transfer volume</h2>
            </div>
            <AutoRefreshControl updatedAt={summary.generatedAt} />
          </div>
          <VolumeChart points={summary.volumeByHour} />
        </article>

        <article className="panel system-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">System health</p>
              <h2>All services ready</h2>
            </div>
            <span className="health-orb" aria-label="Healthy" />
          </div>
          <ul className="service-list">
            {[
              ['API gateway', '18 ms'],
              ['Ledger gRPC', '24 ms'],
              ['Settlement worker', 'Consuming'],
              ['Event broker', '0 delayed'],
            ].map(([service, detail]) => (
              <li key={service}>
                <span>
                  <span className="service-dot" aria-hidden="true" /> {service}
                </span>
                <code>{detail}</code>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Audit stream</p>
            <h2>Recent transfers</h2>
          </div>
        </div>
        <RecentTransfers transfers={summary.recentTransfers} />
      </section>
    </>
  );
}
