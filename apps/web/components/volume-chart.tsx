import { formatMoney } from '../lib/format';

export function VolumeChart({ points }: { points: Array<{ hour: string; amountMinor: number }> }) {
  const maximum = Math.max(...points.map((point) => point.amountMinor), 1);
  return (
    <div className="volume-chart" role="img" aria-label="Transfer volume by hour">
      <div className="chart-grid" aria-hidden="true">
        {points.map((point) => (
          <div className="chart-column" key={point.hour}>
            <span className="chart-value">{formatMoney(point.amountMinor)}</span>
            <span
              className="chart-bar"
              style={{ height: `${Math.max((point.amountMinor / maximum) * 100, 8)}%` }}
            />
            <span className="chart-label">
              {new Date(point.hour).toLocaleTimeString('en', { hour: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
