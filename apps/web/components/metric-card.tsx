import type { LucideIcon } from 'lucide-react';

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-detail">{detail}</p>
      </div>
    </article>
  );
}
