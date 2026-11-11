import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransferForm } from './transfer-form';

describe('TransferForm', () => {
  it('blocks a zero-value or self transfer before submission', () => {
    const onSubmit = vi.fn();
    render(<TransferForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('From account'), { target: { value: 'wallet-alice' } });
    fireEvent.change(screen.getByLabelText('To account'), { target: { value: 'wallet-alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create transfer' }));

    expect(screen.getByRole('alert')).toHaveTextContent('positive amount');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
