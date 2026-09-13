import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecordPaymentModal from './RecordPaymentModal';
import type { RecordPaymentInput } from '../types/invoice';
import { clearInvoiceDraftRecoveries } from '../lib/invoiceDraftRecovery';
import {
  readPendingInvoicePayment, rememberPendingInvoicePayment, clearPendingInvoicePayment, PENDING_PAYMENT_TTL_MS,
} from '../lib/pendingInvoicePayment';

const context = { userId: 'owner-a', invoiceId: 'invoice-a' };
function input(amount = 40): RecordPaymentInput {
  return { operationId: crypto.randomUUID(), amount, paymentDate: '2026-09-13', method: 'bank_transfer', reference: 'Test transfer', notes: 'Private test note', sendAcknowledgement: true };
}
function show(onConfirm = vi.fn<(payment: RecordPaymentInput) => Promise<void>>().mockRejectedValue(new Error('The response could not be confirmed.')), options: { ownerId?: string; invoiceId?: string; amountDue?: number; canRecordNew?: boolean } = {}) {
  return { ...render(<RecordPaymentModal ownerId={options.ownerId || context.userId} invoiceId={options.invoiceId || context.invoiceId} amountDue={options.amountDue ?? 100} canRecordNew={options.canRecordNew ?? true} onClose={() => {}} onConfirm={onConfirm} />), onConfirm };
}
beforeEach(() => { window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('pending invoice payment recovery', () => {
  it('retries an uncertain request with its original ID and locks changed details', async () => {
    const { onConfirm } = show();
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Reference (optional)')).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reference (optional)'), 'Changed reference');
    fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(onConfirm.mock.calls[1][0]).toEqual(onConfirm.mock.calls[0][0]);
    expect(onConfirm.mock.calls[0][0].operationId).toMatch(/^[a-f\d-]{36}$/);
    expect(screen.getByRole('button', { name: 'Clear reviewed request' })).toBeDisabled();
  });

  it('keeps the original payload and ID across modal close/reopen and a reload-equivalent new instance', async () => {
    const first = show();
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Reference (optional)'), { target: { value: 'Bank reference' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await screen.findByRole('alert');
    const submitted = first.onConfirm.mock.calls[0][0];
    first.unmount();
    const reopened = show(undefined, { amountDue: 60 });
    expect(screen.getByLabelText(/Amount/)).toHaveValue(40);
    expect(screen.getByLabelText('Reference (optional)')).toHaveValue('Bank reference');
    expect(reopened.onConfirm).not.toHaveBeenCalled();
    reopened.unmount();
    const reloaded = show(undefined, { amountDue: 60 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
    await waitFor(() => expect(reloaded.onConfirm).toHaveBeenCalledWith(submitted));
  });

  it('allows only the same-request retry even when the fresh invoice is fully paid', async () => {
    const pending = input(100);
    rememberPendingInvoicePayment(context, pending);
    const { onConfirm } = show(undefined, { amountDue: 0, canRecordNew: false });
    expect(screen.getByRole('button', { name: 'Retry same request' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(pending));
  });

  it('does not inherit requests from another invoice or another owner', () => {
    rememberPendingInvoicePayment(context, input());
    const otherInvoice = show(undefined, { invoiceId: 'invoice-b' });
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
    expect(screen.getByLabelText(/Amount/)).toHaveValue(100);
    otherInvoice.unmount();
    show(undefined, { ownerId: 'owner-b' });
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
    expect(readPendingInvoicePayment(context).status).toBe('pending');
  });

  it('requires reviewed discard before a changed payment becomes a new operation', async () => {
    const old = input();
    rememberPendingInvoicePayment(context, old);
    const { onConfirm } = show();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /checked the invoice payment history/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear reviewed request' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Reference (optional)')).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Reference (optional)'), { target: { value: 'Reviewed new payment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm.mock.calls[0][0].operationId).not.toBe(old.operationId);
  });

  it.each(['expired', 'corrupt'])('keeps a review marker for an %s request across repeated opens and removes personal payload', (kind) => {
    rememberPendingInvoicePayment(context, input());
    const key = window.sessionStorage.key(0)!;
    const record = JSON.parse(window.sessionStorage.getItem(key)!);
    window.sessionStorage.setItem(key, kind === 'corrupt' ? '{invalid' : JSON.stringify({ ...record, createdAt: Date.now() - PENDING_PAYMENT_TTL_MS - 1 }));
    const first = show();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    expect(screen.getByText(/personal details were removed/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(key)).not.toContain('Private test note');
    expect(window.sessionStorage.getItem(key)).not.toContain('Test transfer');
    first.unmount();
    show();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    expect(readPendingInvoicePayment(context).status).toBe('review');
  });

  it('does not POST when browser storage cannot persist the request', () => {
    const { onConfirm } = show();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded'); });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('No payment request was sent');
  });

  it('blocks submission when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    const { onConfirm } = show();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('cannot preserve a payment request safely');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clears only after a confirmed response', async () => {
    const onConfirm = vi.fn<(payment: RecordPaymentInput) => Promise<void>>(async (payment) => {
      clearPendingInvoicePayment(context, payment.operationId);
    });
    const view = show(onConfirm);
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(readPendingInvoicePayment(context).status).toBe('none'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    view.unmount();
    show();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
  });

  it('logout/access revocation clears pending requests and blocks late handlers from restoring or retrying them', async () => {
    let reject!: (reason: Error) => void;
    const onConfirm = vi.fn<(payment: RecordPaymentInput) => Promise<void>>(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    show(onConfirm);
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(readPendingInvoicePayment(context).status).toBe('pending');
    act(() => clearInvoiceDraftRecoveries());
    await act(async () => { reject(new Error('Late failure')); });
    expect(readPendingInvoicePayment(context).status).toBe('none');
    fireEvent.submit(screen.getByRole('button', { name: 'Recording…' }).closest('form')!);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks repeated clicks while the first save is pending', () => {
    const onConfirm = vi.fn<(payment: RecordPaymentInput) => Promise<void>>(() => new Promise(() => {}));
    show(onConfirm);
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recording…' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(readPendingInvoicePayment(context).status).toBe('pending');
  });

  it('never evicts an unresolved request to make space for a new one', () => {
    for (let index = 0; index < 20; index += 1) {
      expect(rememberPendingInvoicePayment({ ...context, invoiceId: 'invoice-' + index }, input())).toBe(true);
    }
    expect(rememberPendingInvoicePayment(context, input())).toBe(false);
    expect(readPendingInvoicePayment({ ...context, invoiceId: 'invoice-0' }).status).toBe('pending');
  });
});
