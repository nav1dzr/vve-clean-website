import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CleaningRecordBuilder from './CleaningRecordBuilder';

describe('CleaningRecordBuilder', () => {
  it('requires review, separates access charges and includes owner-edited work and exceptions', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<CleaningRecordBuilder serviceDate="2026-01-01" descriptions={['1 x Bedroom carpet', '1 x Parking: £15', 'Congestion Charge: £18']} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: 'Add cleaning completion record' }));
    expect(screen.getByLabelText('Work carried out')).toHaveValue('1 x Bedroom carpet');
    const add = screen.getByRole('button', { name: 'Add to invoice and paid receipt' });
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText('Exceptions or areas not cleaned (optional)'), 'Permanent ink mark remains.');
    await user.click(screen.getByRole('checkbox'));
    await user.click(add);
    expect(onAdd).toHaveBeenCalledOnce();
    const text = onAdd.mock.calls[0][0];
    expect(text).toContain('Service completed on 1 January 2026');
    expect(text).toContain('Bedroom carpet');
    expect(text).toContain('Permanent ink mark remains.');
    expect(text).not.toContain('Parking');
    expect(text).not.toContain('Congestion');
    expect(text).not.toContain('No exceptions');
  });

  it('does not allow a completion statement for a future or missing date', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CleaningRecordBuilder serviceDate="2999-01-01" descriptions={['Carpet']} onAdd={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add cleaning completion record' }));
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Add to invoice and paid receipt' })).toBeDisabled();
    rerender(<CleaningRecordBuilder serviceDate="" descriptions={['Carpet']} onAdd={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add to invoice and paid receipt' })).toBeDisabled();
  });
});
