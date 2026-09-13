import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch }));
import EnquiriesPage from './EnquiriesPage';
const row = { id: '6155fbfb-7db7-4c5a-b7bb-9b8c67edb8d8', full_name: 'Synthetic customer', email: 'test@example.com', message: 'Please quote.', status: 'new', notes: '', created_at: '2026-09-08T10:00:00Z', updated_at: '2026-09-08T10:00:00Z', delivery: { customerEmail: { status: 'failed' } } };
beforeEach(() => { vi.clearAllMocks(); authFetch.mockResolvedValue({ enquiries: [row], total: 1 }); });
describe('CRM enquiry editing and delivery recovery', () => {
  it('protects unsaved notes from refresh or retry, and submits the displayed revision', async () => {
    render(<EnquiriesPage />); await screen.findByText(row.full_name);
    fireEvent.change(screen.getByLabelText('Staff notes'), { target: { value: 'Call tomorrow.' } });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry unconfirmed notifications', hidden: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save enquiry' }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(3));
    const request = JSON.parse(authFetch.mock.calls[1][1].body);
    expect(request).toMatchObject({ notes: 'Call tomorrow.', expectedUpdatedAt: row.updated_at, action: 'update' });
  });
  it('requires a destination check before retrying a delivery', async () => {
    render(<EnquiriesPage />); await screen.findByText(row.full_name);
    fireEvent.click(screen.getByText('Notification delivery'));
    const retry = screen.getByRole('button', { name: 'Retry unconfirmed notifications' });
    expect(retry).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I checked the destinations and want to retry missing notifications.'));
    fireEvent.click(retry);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(authFetch.mock.calls[1][1].body)).toMatchObject({ action: 'retry', confirmRetry: true });
  });
  it('ignores a stale response from an earlier StrictMode load', async () => {
    let resolveOlder!: (value: unknown) => void;
    authFetch.mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve; }));
    render(<StrictMode><EnquiriesPage /></StrictMode>);
    await screen.findByText(row.full_name);
    await act(async () => { resolveOlder({ enquiries: [{ ...row, full_name: 'Stale customer' }], total: 1 }); });
    expect(screen.queryByText('Stale customer')).not.toBeInTheDocument();
  });
});
