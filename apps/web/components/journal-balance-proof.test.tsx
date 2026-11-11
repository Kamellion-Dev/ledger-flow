import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JournalBalanceProof } from './journal-balance-proof';

describe('JournalBalanceProof', () => {
  it('shows equal debit and credit totals as balanced', () => {
    render(
      <JournalBalanceProof
        postings={[
          { side: 'DEBIT', amountMinor: 2500 },
          { side: 'CREDIT', amountMinor: 2500 },
        ]}
      />,
    );

    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getAllByText('$25.00')).toHaveLength(2);
  });
});
