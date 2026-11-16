import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SendInvoiceSheet from './SendInvoiceSheet';
import type { InvoiceDetail, InvoiceEmail } from '../types/invoice';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
  }
  return { authFetch: (...args: unknown[]) => authFetchMock(...args), ApiError: MockApiError };
});
const { ApiError } = await import('../lib/authFetch');

// Synthetic invoice only.
const invoice = {
  id: 'inv-1', invoiceNumber: 'VVE-INV-2026-000900', customer: { name: 'Sample Customer', email: 'customer@example.invalid', phone: null, address: null, postcode: null },
  invoiceRecipientEmail: null, total: 285, depositApplied: 30, amountDue: 255, dueDate: '2026-11-24',
  paymentInstructions: { paymentOption: 'both', bankDetails: null, stripePaymentLinkUrl: null },
} as unknown as InvoiceDetail;

const email = (overrides: Partial<InvoiceEmail> = {}): InvoiceEmail => ({
  id: 'e1', invoiceId: 'inv-1', recipient: 'customer@example.invalid', message: null, scheduledFor: '2026-11-17T08:00:00.000Z',
  status: 'scheduled', attempts: 0, sentAt: null, attemptedAt: null, reason: null, reasonCode: null, expectedAmountDue: 255,
  createdAt: '2026-11-16T22:00:00.000Z', ...overrides,
});
const body = (call = 0) => JSON.parse(authFetchMock.mock.calls[call][1].body);

describe('SendInvoiceSheet', () => {
  beforeEach(() => { authFetchMock.mockReset(); });

  it('shows what will be sent before anything is sent', () => {
    render(<SendInvoiceSheet invoice={invoice} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText('Invoice VVE-INV-2026-000900 from VVE Clean')).toBeInTheDocument();
    expect(screen.getByText('£255.00')).toBeInTheDocument();
    expect(screen.getByText('VVE-INV-2026-000900.pdf')).toBeInTheDocument();
    expect(screen.getByText('Bank transfer and card link')).toBeInTheDocument();
    expect(screen.getByLabelText('Send to')).toHaveValue('customer@example.invalid');
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('sends now with a request id and reports the result', async () => {
    authFetchMock.mockResolvedValue({ ok: true, outcome: 'sent', email: email({ status: 'sent' }) });
    const onDone = vi.fn();
    render(<SendInvoiceSheet invoice={invoice} onClose={() => {}} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(authFetchMock.mock.calls[0][0]).toBe('/api/invoices/inv-1?action=emailQueue');
    expect(body()).toMatchObject({ op: 'sendNow', to: 'customer@example.invalid' });
    expect(body().id).toMatch(/^[0-9a-f-]{36}$/);
    expect(onDone.mock.calls[0][1]).toBe('Sent to customer@example.invalid.');
  });

  it('schedules for the chosen UK date and time', async () => {
    authFetchMock.mockResolvedValue({ ok: true, outcome: null, email: email() });
    const onDone = vi.fn();
    render(<SendInvoiceSheet invoice={invoice} startScheduled onClose={() => {}} onDone={onDone} />);
    await userEvent.selectOptions(screen.getByLabelText('Time'), '09:15');
    await userEvent.click(screen.getByRole('button', { name: /^Schedule for .*09:15$/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(body()).toMatchObject({ op: 'schedule', time: '09:15' });
    expect(body().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onDone.mock.calls[0][1]).toMatch(/^Email scheduled for .*09:15 \(UK time\) to customer@example.invalid\.$/);
  });

  it('reuses the same request id when the owner tries again after a lost connection', async () => {
    authFetchMock.mockRejectedValueOnce(new ApiError(0, 'Could not reach the server.'));
    authFetchMock.mockResolvedValueOnce({ ok: true, outcome: 'sent', email: email({ status: 'sent' }) });
    render(<SendInvoiceSheet invoice={invoice} onClose={() => {}} onDone={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot receive it twice/);
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(body(1).id).toBe(body(0).id);
  });

  it('ignores a second tap while the first is still in flight', async () => {
    authFetchMock.mockReturnValue(new Promise(() => {}));
    render(<SendInvoiceSheet invoice={invoice} onClose={() => {}} onDone={() => {}} />);
    const button = screen.getByRole('button', { name: 'Send now' });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('button', { name: 'Working…' }));
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes on an unconfirmed send as a warning to act on', async () => {
    authFetchMock.mockResolvedValue({ ok: true, outcome: 'uncertain', warning: 'Check Sent mail in Gmail before sending again.', email: email({ status: 'uncertain' }) });
    const onDone = vi.fn();
    render(<SendInvoiceSheet invoice={invoice} onClose={() => {}} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][1]).toBe('Check Sent mail in Gmail before sending again.');
  });

  it('only changes the time when editing a scheduled email', async () => {
    authFetchMock.mockResolvedValue({ ok: true, outcome: null, email: email() });
    render(<SendInvoiceSheet invoice={invoice} reschedule={email()} onClose={() => {}} onDone={() => {}} />);
    expect(screen.queryByLabelText('Send to')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Move to / }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled());
    expect(body()).toMatchObject({ op: 'reschedule', id: 'e1' });
  });
});
