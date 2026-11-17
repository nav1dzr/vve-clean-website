import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch, ApiError: Error }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ admin: { id: 'owner-fixture' } }) }));
import EnquiriesPage from './EnquiriesPage';
const row = { id: '6155fbfb-7db7-4c5a-b7bb-9b8c67edb8d8', full_name: 'Synthetic customer', email: 'test@example.com', message: 'Please quote.', status: 'new', notes: '', created_at: '2026-09-08T10:00:00Z', updated_at: '2026-09-08T10:00:00Z', delivery: { customerEmail: { status: 'failed' } } };
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); authFetch.mockResolvedValue({ enquiries: [row], total: 1 }); });
describe('CRM enquiry editing and delivery recovery', () => {
  it('protects unsaved notes from refresh or retry, and submits the displayed revision', async () => {
    render(<MemoryRouter><EnquiriesPage /></MemoryRouter>); await screen.findByText(row.full_name);
    fireEvent.change(screen.getByLabelText('Staff notes'), { target: { value: 'Call tomorrow.' } });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry unconfirmed notifications', hidden: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save enquiry' }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(3));
    const request = JSON.parse(authFetch.mock.calls[1][1].body);
    expect(request).toMatchObject({ notes: 'Call tomorrow.', expectedUpdatedAt: row.updated_at, action: 'update' });
  });
  it('requires a destination check before retrying a delivery', async () => {
    render(<MemoryRouter><EnquiriesPage /></MemoryRouter>); await screen.findByText(row.full_name);
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
    render(<StrictMode><MemoryRouter><EnquiriesPage /></MemoryRouter></StrictMode>);
    await screen.findByText(row.full_name);
    await act(async () => { resolveOlder({ enquiries: [{ ...row, full_name: 'Stale customer' }], total: 1 }); });
    expect(screen.queryByText('Stale customer')).not.toBeInTheDocument();
  });
});

describe('enquiry to booking handoff', () => {
  it('requires a contact and explicit payment choice, then opens the linked booking', async () => {
    const contact = { id: '123e4567-e89b-42d3-a456-426614174101', name: 'Sample agent', email: 'agent@example.invalid' };
    const user = userEvent.setup();
    authFetch.mockImplementation(async (url: string) => {
      if (url.includes('action=bookings')) return { ok: true, bookingId: row.id, bookingRef: 'SAMPLE' };
      if (url.includes('enquiryId=')) return { enquiry: { ...row, service: 'Carpet cleaning' }, booking: null };
      if (url.startsWith('/api/customers?q=')) return { results: [contact] };
      return { enquiries: [row], total: 1 };
    });
    render(<MemoryRouter initialEntries={['/enquiries']}><Routes>
      <Route path="/enquiries" element={<EnquiriesPage />} />
      <Route path="/bookings/:id" element={<h1>Saved booking</h1>} />
    </Routes></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Start booking draft' }));
    expect(await screen.findByRole('button', { name: 'Continue to booking details' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Find customers' }));
    await user.click(await screen.findByRole('button', { name: /Sample agent/ }));
    await user.selectOptions(screen.getByLabelText('Contact role'), 'agent');
    await user.click(screen.getByRole('button', { name: 'Find customers' }));
    await user.click(await screen.findByRole('button', { name: /Sample agent/ }));
    await user.click(screen.getByRole('button', { name: 'Continue to booking details' }));
    expect(screen.getByLabelText(/Service \*/)).toHaveValue('Carpet cleaning');
    await user.click(screen.getByRole('button', { name: 'Create booking' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Choose');
    await user.selectOptions(screen.getByLabelText(/Payment arrangement/), 'after_clean');
    await user.click(screen.getByRole('button', { name: 'Create booking' }));
    expect(await screen.findByRole('heading', { name: 'Saved booking' })).toBeInTheDocument();
    const call = authFetch.mock.calls.find(([url]) => url.includes('action=bookings'));
    expect(call?.[0]).toContain(contact.id);
    expect(JSON.parse(call?.[1].body)).toMatchObject({ requestId: row.id, enquiryId: row.id,
      expectedEnquiryUpdatedAt: row.updated_at, contactRoles: { agent: contact.id }, paymentPlan: 'after_clean', address: null });
    expect(sessionStorage.length).toBe(0);
  });

  it('opens an existing linked booking from the original enquiry route', async () => {
    authFetch.mockResolvedValue({ enquiry: row, booking: { id: row.id, reference: 'SAMPLE' } });
    render(<MemoryRouter initialEntries={['/enquiries?enquiry=' + row.id]}><EnquiriesPage /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Open linked booking SAMPLE' });
    expect(link).toHaveAttribute('href', '/bookings/' + row.id);
    expect(screen.getByText(row.message)).toBeInTheDocument();
  });
});
