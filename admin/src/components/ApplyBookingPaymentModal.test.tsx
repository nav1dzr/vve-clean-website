import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplyBookingPaymentModal from './ApplyBookingPaymentModal';
import { clearInvoiceDraftRecoveries } from '../lib/invoiceDraftRecovery';
import { readPendingBookingAllocation } from '../lib/pendingBookingAllocation';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: fetchMock, ApiError: Error }));

const context = { invoiceId: 'fixture-invoice', userId: 'fixture-owner' };
const review = {
  ok: true, invoiceId: context.invoiceId, expectedInvoiceUpdatedAt: '2026-11-04T12:00:00.123456Z',
  expectedJourneyRevision: 7, invoiceDuePence: 12000, depositAppliedPence: 3000,
  depositSources: [{ sourcePaymentId: 'fixture-deposit', amountPence: 3000, recordedAt: '2026-11-03T12:00:00Z' }],
  candidates: [{ sourcePaymentId: 'fixture-balance', kind: 'manual_balance', amountPence: 12000,
    recordedAt: '2026-11-04T12:00:00Z', requiresDepositReview: true,
    decision: { state: 'review_ready', invoiceDueAfterPence: 0 } }],
};
const saved = { ok: true, allocationId: 'fixture-allocation', paymentId: 'fixture-payment',
  receiptId: 'fixture-receipt', amountDue: 0, amountPaid: 120, paymentStatus: 'paid', replayed: false };
const show = (onApplied = vi.fn()) => render(<ApplyBookingPaymentModal invoiceId={context.invoiceId}
  ownerId={context.userId} onClose={vi.fn()} onApplied={onApplied} />);

async function fillReview() {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText('Existing balance payment'), 'fixture-balance');
  await user.selectOptions(screen.getByLabelText('Original payment method'), 'bank_transfer');
  await user.click(screen.getByRole('checkbox', { name: /original payment reference and invoice history/ }));
  return user;
}
beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
});

describe('apply an existing booking payment', () => {
  it('requires both checks, shows the original deposit reference and reports the saved receipt', async () => {
    fetchMock.mockResolvedValueOnce(review).mockResolvedValueOnce(saved);
    const onApplied = vi.fn();
    show(onApplied);
    const user = await fillReview();
    expect(screen.getByText(/fixture-deposit/)).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply existing booking payment' });
    expect(apply).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /deposit already applied/ }));
    expect(apply).toBeEnabled();
    await user.click(apply);
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(saved));
    expect(readPendingBookingAllocation(context)).toEqual({ status: 'none' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      sourcePaymentId: 'fixture-balance', expectedInvoiceUpdatedAt: review.expectedInvoiceUpdatedAt,
      expectedJourneyRevision: 7, reviewedSource: true, depositReviewed: true, paymentDate: '2026-11-04',
    });
  });

  it('reuses the identical request after an uncertain response and a remount', async () => {
    fetchMock.mockResolvedValueOnce(review).mockRejectedValueOnce(new Error('lost response'));
    const first = show();
    const user = await fillReview();
    await user.click(screen.getByRole('checkbox', { name: /deposit already applied/ }));
    await user.click(screen.getByRole('button', { name: 'Apply existing booking payment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('still pending');
    const sentBody = fetchMock.mock.calls[1][1].body;
    first.unmount();
    const onApplied = vi.fn();
    fetchMock.mockResolvedValueOnce({ ...saved, replayed: true });
    show(onApplied);
    await user.click(screen.getByRole('button', { name: 'Retry saved allocation' }));
    await waitFor(() => expect(onApplied).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[2][1].body).toBe(sentBody);
  });

  it('holds refunded sources without sending a payment request', async () => {
    fetchMock.mockResolvedValueOnce({
      ...review, candidates: [{ ...review.candidates[0], decision: { state: 'needs_review', code: 'refund_requires_review' } }],
    });
    const user = userEvent.setup();
    show();
    await user.selectOptions(await screen.findByLabelText('Existing balance payment'), 'fixture-balance');
    expect(screen.getByText(/This booking has a refund/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply existing booking payment' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('ignores a late successful response after access is cleared', async () => {
    let resolve!: (result: typeof saved) => void;
    fetchMock.mockResolvedValueOnce(review).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const onApplied = vi.fn();
    show(onApplied);
    const user = await fillReview();
    await user.click(screen.getByRole('checkbox', { name: /deposit already applied/ }));
    await user.click(screen.getByRole('button', { name: 'Apply existing booking payment' }));
    await act(async () => { clearInvoiceDraftRecoveries(); resolve(saved); });
    expect(onApplied).not.toHaveBeenCalled();
    expect(readPendingBookingAllocation(context)).toEqual({ status: 'none' });
  });
});
