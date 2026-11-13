import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardSummary } from '@ledgerflow/contracts';
import { MemoryRouter } from 'react-router-dom';
import { DashboardOverview } from './dashboard-overview';

const summary: DashboardSummary = {
  totalVolumeMinor: 182_450,
  settledVolumeMinor: 167_200,
  pendingCount: 3,
  settledCount: 42,
  failedCount: 1,
  accountCount: 3,
  recentTransfers: [],
  volumeByHour: [
    { hour: '2026-11-11T16:00:00.000Z', amountMinor: 18_000 },
    { hour: '2026-11-11T17:00:00.000Z', amountMinor: 31_500 },
  ],
  generatedAt: '2026-11-11T20:00:00.000Z',
};

describe('DashboardOverview', () => {
  it('renders financial metrics with explicit simulated-money context', () => {
    render(
      <MemoryRouter>
        <DashboardOverview summary={summary} />
      </MemoryRouter>,
    );

    expect(screen.getByText('$1,824.50')).toBeInTheDocument();
    expect(screen.getByText('42 settled')).toBeInTheDocument();
    expect(screen.getByText(/simulated funds/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /transfer volume/i })).toBeInTheDocument();
  });
});
