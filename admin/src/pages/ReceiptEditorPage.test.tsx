import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReceiptEditorPage from './ReceiptEditorPage';
import { clearInvoiceDraftRecoveries } from '../lib/invoiceDraftRecovery';
import { readPendingStandaloneReceipt, rememberPendingStandaloneReceipt, PENDING_RECEIPT_TTL_MS } from '../lib/pendingStandaloneReceipt';
import type { StandaloneReceiptInput } from '../types/invoice';
import { ApiError } from '../lib/authFetch';

const { authFetchMock, navigateMock, account } = vi.hoisted(() => ({ authFetchMock: vi.fn(), navigateMock: vi.fn(), account: { id: 'owner-test' } }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ admin: { id: account.id } }) }));

vi.mock('../lib/authFetch', () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    authFetch: (...args: unknown[]) => authFetchMock(...args),
    ApiError: MockApiError,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(<MemoryRouter><ReceiptEditorPage /></MemoryRouter>);
}

describe('ReceiptEditorPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    navigateMock.mockReset();
    account.id = 'owner-test';
    window.sessionStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('explains that the flow records an existing payment without charging Stripe', () => {
    renderPage();
    expect(screen.getByText(/does not charge a card, create a balance, or change stripe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create final receipt/i })).toBeDisabled();
  });

  it('requires contact details and explicit payment confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Customer name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('What did they pay for? *'), 'End of tenancy cleaning');
    await user.type(screen.getByLabelText('Amount received (£) *'), '250');
    await user.click(screen.getByText(/I confirm this payment has already been received/i));
    await user.click(screen.getByRole('button', { name: /create final receipt/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/email address or phone number/i);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  function fillDateTestReceipt(paymentDate: string) {
    fireEvent.change(screen.getByLabelText('Customer name *'), { target: { value: 'TEST ONLY - receipt date' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '07700900977' } });
    fireEvent.change(screen.getByLabelText('What did they pay for? *'), { target: { value: 'Synthetic cleaning' } });
    fireEvent.change(screen.getByLabelText('Amount received (£) *'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Payment date *'), { target: { value: paymentDate } });
    fireEvent.click(screen.getByRole('checkbox'));
  }

  it('blocks future dates before sending or storing a receipt, even if native form validation is bypassed', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-01T23:30:00Z'));
    renderPage();
    fillDateTestReceipt('2026-12-02');
    fireEvent.submit(screen.getByRole('button', { name: 'Create final receipt' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment date cannot be in the future (London time).');
    expect(screen.getByLabelText('Payment date *')).toHaveAttribute('max', '2026-12-01');
    expect(authFetchMock).not.toHaveBeenCalled();
    expect(readPendingStandaloneReceipt(account.id).status).toBe('none');
  });

  it('uses the current London date at submit time when the form stays open over midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T22:59:00Z'));
    authFetchMock.mockResolvedValue({ ok: true, receiptId: 'receipt-midnight' });
    renderPage();
    fillDateTestReceipt('2026-07-02');
    expect(screen.getByLabelText('Payment date *')).toHaveAttribute('max', '2026-07-01');
    vi.setSystemTime(new Date('2026-07-01T23:01:00Z'));
    fireEvent.focus(screen.getByLabelText('Payment date *'));
    expect(screen.getByLabelText('Payment date *')).toHaveAttribute('max', '2026-07-02');
    fireEvent.submit(screen.getByRole('button', { name: 'Create final receipt' }).closest('form')!);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/receipts/receipt-midnight'));
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body).paymentDate).toBe('2026-07-02');
  });

  it('allows exact recovery of a previously submitted receipt even if its saved date is in the future', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const input: StandaloneReceiptInput = {
      requestId: 'd82c6ccb-e8eb-4410-a649-ab59f395b76b',
      customer: { name: 'TEST ONLY - prior receipt', phone: '07700900977', email: null, address: null, postcode: null },
      serviceDescription: 'Synthetic previously saved payment', amount: 10,
      paymentDate: '2026-10-19', paymentMethod: 'bank_transfer',
    };
    rememberPendingStandaloneReceipt(account.id, input);
    authFetchMock.mockResolvedValue({ ok: true, receiptId: input.requestId });
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: 'Retry same receipt' }).closest('form')!);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(`/receipts/${input.requestId}`));
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body)).toEqual(input);
  });

  it('submits a standalone receipt with a structured address and opens it', async () => {
    const user = userEvent.setup();
    const pasteField = async (label: string, value: string) => {
      await user.click(screen.getByLabelText(label));
      await user.paste(value);
    };
    authFetchMock.mockResolvedValue({ ok: true, receiptId: 'receipt-1', receiptNumber: 'REC-2026-000001' });
    renderPage();

    await pasteField('Customer name *', 'Jane Doe');
    await pasteField('Email', 'jane@example.com');
    await pasteField('Address line 1', '10 High Road');
    await pasteField('Address line 2', 'Flat 4');
    await pasteField('Town or city', 'London');
    await pasteField('Postcode', 'N15 2NG');
    await pasteField('What did they pay for? *', 'End of tenancy cleaning');
    await user.type(screen.getByLabelText('Amount received (£) *'), '250');
    await user.click(screen.getByText(/I confirm this payment has already been received/i));
    await user.click(screen.getByRole('button', { name: /create final receipt/i }));

    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    const [path, options] = authFetchMock.mock.calls[0];
    expect(path).toBe('/api/receipts');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      customer: { name: 'Jane Doe', email: 'jane@example.com', address: '10 High Road\nFlat 4\nLondon', postcode: 'N15 2NG' },
      serviceDescription: 'End of tenancy cleaning',
      amount: 250,
    });
    expect(navigateMock).toHaveBeenCalledWith('/receipts/receipt-1');
  });

  it('retries the identical operation and freezes the original details after an uncertain save', async () => {
    const user = userEvent.setup();
    authFetchMock.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ ok: true, receiptId: 'receipt-original' });
    renderPage();
    await user.type(screen.getByLabelText('Customer name *'), 'Synthetic retry');
    await user.type(screen.getByLabelText('Email'), 'retry@example.invalid');
    await user.type(screen.getByLabelText('What did they pay for? *'), 'Synthetic clean');
    await user.type(screen.getByLabelText('Amount received (£) *'), '85');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create final receipt' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Amount received (£) *')).toBeDisabled();
    expect(screen.getByText(/original details are kept for a safe retry/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    expect(authFetchMock.mock.calls[1][1].body).toBe(authFetchMock.mock.calls[0][1].body);
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body).requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(navigateMock).toHaveBeenCalledWith('/receipts/receipt-original');
  });

  const pending: StandaloneReceiptInput = { requestId: '0348769e-a41f-4b4e-83f2-03885cb54c11', customer: { name: 'Synthetic recovery', email: 'recover@example.invalid', phone: null, address: null, postcode: null }, serviceDescription: 'Synthetic clean', amount: 85, paymentDate: '2026-10-15', paymentMethod: 'bank_transfer', paymentReference: 'TEST-ONLY' };

  it('restores the original operation and details after refreshing an uncertain save', async () => {
    const user = userEvent.setup();
    rememberPendingStandaloneReceipt(account.id, pending);
    authFetchMock.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({ ok: true, receiptId: 'original-id' });
    const first = renderPage();
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    await screen.findByRole('alert');
    first.unmount();
    renderPage();
    expect(screen.getByLabelText('Customer name *')).toHaveValue('Synthetic recovery');
    expect(screen.getByLabelText('Customer name *')).toBeDisabled();
    expect(screen.getByLabelText('Amount received (£) *')).toHaveValue(85);
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/receipts/original-id'));
    expect(authFetchMock.mock.calls[0][1].body).toBe(JSON.stringify(pending));
    expect(authFetchMock.mock.calls[1][1].body).toBe(JSON.stringify(pending));
    expect(readPendingStandaloneReceipt(account.id).status).toBe('none');
  });

  it('keeps the exact operation after an uncertain database insert returns 503', async () => {
    const user = userEvent.setup();
    rememberPendingStandaloneReceipt(account.id, pending);
    authFetchMock.mockRejectedValueOnce(new ApiError(503, 'Could not verify whether the receipt was saved. Retry the same receipt.'))
      .mockResolvedValueOnce({ ok: true, receiptId: pending.requestId, alreadyExisted: true });
    const first = renderPage();
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    await screen.findByRole('alert');
    expect(readPendingStandaloneReceipt(account.id)).toMatchObject({ status: 'pending', input: pending });
    first.unmount();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    expect(authFetchMock.mock.calls.map(([, options]) => options.body)).toEqual([JSON.stringify(pending), JSON.stringify(pending)]);
    expect(navigateMock).toHaveBeenCalledWith(`/receipts/${pending.requestId}`);
  });

  it('does not show or replay another account’s recovered customer details', () => {
    rememberPendingStandaloneReceipt(account.id, pending);
    const page = renderPage();
    expect(screen.getByLabelText('Customer name *')).toHaveValue('Synthetic recovery');
    account.id = 'other-owner';
    page.rerender(<MemoryRouter><ReceiptEditorPage /></MemoryRouter>);
    expect(screen.getByLabelText('Customer name *')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Retry same receipt' })).not.toBeInTheDocument();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('does not send a receipt when it cannot preserve the operation before submitting', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Customer name *'), 'Synthetic blocked storage');
    await user.type(screen.getByLabelText('Email'), 'blocked@example.invalid');
    await user.type(screen.getByLabelText('What did they pay for? *'), 'Synthetic clean');
    await user.type(screen.getByLabelText('Amount received (£) *'), '85');
    await user.click(screen.getByRole('checkbox'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Create final receipt' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No new request was sent');
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('blocks expired recovery until the owner checks receipts and explicitly clears it', async () => {
    const user = userEvent.setup();
    rememberPendingStandaloneReceipt(account.id, pending);
    const key = 'vve-pending-standalone-receipt:v1:owner-test';
    const stored = JSON.parse(window.sessionStorage.getItem(key)!);
    window.sessionStorage.setItem(key, JSON.stringify({ ...stored, createdAt: Date.now() - PENDING_RECEIPT_TTL_MS - 1 }));
    authFetchMock.mockRejectedValue(new ApiError(404, 'Not found'));
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('more than 24 hours old');
    expect(screen.getByRole('button', { name: 'Create final receipt' })).toBeDisabled();
    expect(screen.getByLabelText('Customer name *')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Clear reviewed recovery record' })).toBeDisabled();
    await screen.findByText(/The original receipt was not found/);
    await user.click(screen.getByLabelText('I checked Receipts and this payment has no receipt.'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Clear reviewed recovery record' }));
    expect(readPendingStandaloneReceipt(account.id).status).toBe('review');
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Clear reviewed recovery record' }));
    expect(readPendingStandaloneReceipt(account.id).status).toBe('none');
    expect(screen.getByLabelText('Customer name *')).toBeEnabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(authFetchMock).toHaveBeenCalledWith(`/api/receipts?id=${pending.requestId}`);
  });

  function expirePending() {
    rememberPendingStandaloneReceipt(account.id, pending);
    const key = `vve-pending-standalone-receipt:v1:${account.id}`;
    const stored = JSON.parse(window.sessionStorage.getItem(key)!);
    window.sessionStorage.setItem(key, JSON.stringify({ ...stored, createdAt: Date.now() - PENDING_RECEIPT_TTL_MS - 1 }));
  }

  it('finds an expired operation by exact ID and opens the saved receipt without requiring a false no-receipt declaration', async () => {
    const user = userEvent.setup();
    expirePending();
    authFetchMock.mockResolvedValue({ id: pending.requestId, source: 'standalone', createdByAdminId: account.id });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Open saved receipt' })).toHaveAttribute('href', `/receipts/${pending.requestId}`);
    expect(readPendingStandaloneReceipt(account.id).status).toBe('none');
    expect(screen.queryByLabelText('I checked Receipts and this payment has no receipt.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create a different receipt' }));
    expect(screen.getByLabelText('Customer name *')).toBeEnabled();
    expect(screen.getByLabelText('Customer name *')).toHaveValue('');
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(authFetchMock).toHaveBeenCalledWith(`/api/receipts?id=${pending.requestId}`);
  });

  it('retains the recovery marker on verification failure and can retry the exact lookup', async () => {
    const user = userEvent.setup();
    expirePending();
    authFetchMock.mockRejectedValueOnce(new ApiError(503, 'Unavailable')).mockResolvedValueOnce({ id: pending.requestId, source: 'standalone', createdByAdminId: account.id });
    renderPage();
    await screen.findByRole('button', { name: 'Retry receipt check' });
    expect(screen.getByLabelText('I checked Receipts and this payment has no receipt.')).toBeDisabled();
    expect(readPendingStandaloneReceipt(account.id).status).toBe('review');
    await user.click(screen.getByRole('button', { name: 'Retry receipt check' }));
    await screen.findByRole('link', { name: 'Open saved receipt' });
    expect(authFetchMock.mock.calls.every(([url, options]) => url === `/api/receipts?id=${pending.requestId}` && !options)).toBe(true);
  });

  it('does not accept a receipt belonging to another admin or clear the unresolved operation', async () => {
    expirePending();
    authFetchMock.mockResolvedValue({ id: pending.requestId, source: 'standalone', createdByAdminId: 'other-owner' });
    renderPage();
    await screen.findByRole('button', { name: 'Retry receipt check' });
    expect(readPendingStandaloneReceipt(account.id).status).toBe('review');
    expect(screen.queryByRole('link', { name: 'Open saved receipt' })).not.toBeInTheDocument();
  });

  it('ignores a late lookup from the previous account after switching accounts', async () => {
    expirePending();
    let resolve!: (value: unknown) => void;
    authFetchMock.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const page = renderPage();
    account.id = 'other-owner';
    page.rerender(<MemoryRouter><ReceiptEditorPage /></MemoryRouter>);
    await act(async () => resolve({ id: pending.requestId, source: 'standalone', createdByAdminId: 'owner-test' }));
    expect(screen.queryByRole('link', { name: 'Open saved receipt' })).not.toBeInTheDocument();
    expect(readPendingStandaloneReceipt('owner-test').status).toBe('review');
    expect(screen.getByLabelText('Customer name *')).toBeEnabled();
  });

  it('shows a blocked state for corrupt or inaccessible recovery storage', () => {
    window.sessionStorage.setItem('vve-pending-standalone-receipt:v1:owner-test', '{bad');
    const page = renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('could not be recovered safely');
    expect(screen.getByLabelText('Customer name *')).toBeDisabled();
    page.unmount();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Browser storage is unavailable');
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('clears pending data at logout and ignores a late response without navigation or a new request', async () => {
    const user = userEvent.setup();
    rememberPendingStandaloneReceipt(account.id, pending);
    let resolve!: (result: unknown) => void;
    authFetchMock.mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    act(() => { clearInvoiceDraftRecoveries(); });
    expect(screen.getByRole('alert')).toHaveTextContent('account access changed');
    await act(async () => { resolve({ ok: true, receiptId: 'old-account-receipt' }); });
    expect(navigateMock).not.toHaveBeenCalled();
    expect(readPendingStandaloneReceipt(account.id).status).toBe('none');
    expect(screen.getByRole('button', { name: /creating receipt/i })).toBeDisabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });

  it('links to the saved receipt and blocks another submission when clearing recovery fails', async () => {
    const user = userEvent.setup();
    rememberPendingStandaloneReceipt(account.id, pending);
    authFetchMock.mockResolvedValue({ ok: true, receiptId: 'saved-once' });
    renderPage();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Retry same receipt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The receipt was saved');
    expect(screen.getByRole('link', { name: 'Open saved receipt' })).toHaveAttribute('href', '/receipts/saved-once');
    expect(screen.getByRole('button', { name: 'Retry same receipt' })).toBeDisabled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
});
