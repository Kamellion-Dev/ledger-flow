import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AutoRefreshControl } from './auto-refresh-control';

describe('AutoRefreshControl', () => {
  it('lets an operator pause and resume updates', () => {
    render(<AutoRefreshControl updatedAt="2026-11-11T20:00:00.000Z" />);

    const button = screen.getByRole('button', { name: 'Pause auto-refresh' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Resume auto-refresh' })).toBeInTheDocument();
  });
});
