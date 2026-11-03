import { act, render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BookingBalancePaymentNotice from './BookingBalancePaymentNotice';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: (...args: unknown[]) => fetchMock(...args) }));
const invoice = { id: 'fixture-invoice', updatedAt: 'v1', documentStatus: 'issued', depositApplied: 30, amountPaid: 100, amountDue: 20 };
const history = { journey: { paid_pence: 13000, refunded_pence: 1000 }, payments: [{ kind: 'manual_balance', amount_pence: 10000 }] };
function notice(bookingId = 'fixture-booking', accountId = 'fixture-owner', version = 'v1') {
  return <MemoryRouter><BookingBalancePaymentNotice bookingId={bookingId} accountId={accountId} invoice={{ ...invoice, updatedAt: version }} /></MemoryRouter>;
}
beforeEach(() => fetchMock.mockReset());

describe('linked booking payment review', () => {
  it('shows two separate records without inventing a combined balance or allocation', async () => {
    fetchMock.mockResolvedValue(history);
    render(notice());
    const panel = await screen.findByRole('region', { name: 'Linked booking payment review' });
    await screen.findByText('Booking payment record');
    expect(within(panel).getByText('£130.00')).toBeInTheDocument();
    expect(within(panel).getByText('£10.00')).toBeInTheDocument();
    expect(within(panel).getByText('£120.00')).toBeInTheDocument();
    expect(within(panel).getByText('Invoice amount due').nextElementSibling).toHaveTextContent('£20.00');
    expect(screen.getByText(/Matching amounts do not prove a link/)).toBeInTheDocument();
    expect(fetchMock.mock.calls).toEqual([['/api/bookings/fixture-booking?action=journey']]);
  });
  it('shows a deposit-only record and a refreshed authoritative refund total', async () => {
    fetchMock.mockResolvedValueOnce({ journey: { paid_pence: 3000, refunded_pence: 0 }, payments: [] })
      .mockResolvedValueOnce({ journey: { paid_pence: 3000, refunded_pence: 3000 }, payments: [] });
    const user = userEvent.setup();
    render(notice());
    expect(await screen.findByText('Payments are recorded on this booking')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh payment check' }));
    const label = await screen.findByText('After refunds');
    expect(label.nextElementSibling).toHaveTextContent('£0.00');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('makes a failed read retryable without asserting a payment', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(history);
    const user = userEvent.setup();
    render(notice());
    expect(await screen.findByText('Could not check booking payments')).toBeInTheDocument();
    expect(screen.queryByText('Booking payment record')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry payment check' }));
    expect(await screen.findByText('Booking payment record')).toBeInTheDocument();
  });
  it('discards a delayed response after moving to another booking or owner', async () => {
    let resolveOld!: (data: typeof history) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue({ journey: null });
    const view = render(notice());
    view.rerender(notice('next-booking', 'next-owner'));
    await act(async () => { resolveOld(history); });
    expect(screen.queryByText('Booking payment record')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review booking payments' })).not.toBeInTheDocument();
  });
  it('refreshes after saved invoice state changes', async () => {
    fetchMock.mockResolvedValue(history);
    const view = render(notice());
    await screen.findByText('Booking payment record');
    view.rerender(notice('fixture-booking', 'fixture-owner', 'v2'));
    await screen.findByText('Booking payment record');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('labels saved draft figures so unsaved edits are not presented as current', async () => {
    fetchMock.mockResolvedValue(history);
    render(<MemoryRouter><BookingBalancePaymentNotice bookingId="fixture-booking" accountId="fixture-owner" invoice={{ ...invoice, documentStatus: 'draft' }} /></MemoryRouter>);
    expect(await screen.findByText('Saved invoice figures')).toBeInTheDocument();
    expect(screen.getByText('Unsaved invoice edits are not included here.')).toBeInTheDocument();
  });
});
