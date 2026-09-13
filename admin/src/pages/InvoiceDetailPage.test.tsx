import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InvoiceDetailPage from './InvoiceDetailPage';
import { ApiError } from '../lib/authFetch';
import type { InvoiceDetail } from '../types/invoice';

const { authFetchMock, authFetchBlobMock } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
  authFetchBlobMock: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ admin: { id: 'admin-1', email: 'owner@example.invalid', displayName: 'Audit owner' } }),
}));

beforeEach(() => { window.sessionStorage.clear(); });

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
    authFetchBlob: (...args: unknown[]) => authFetchBlobMock(...args),
    ApiError: MockApiError,
  };
});

function renderDetail(id = 'inv-1') {
  return render(
    <MemoryRouter initialEntries={[`/invoices/${id}`]}>
      <Routes>
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const draftInvoice: InvoiceDetail = {
  id: 'inv-1', bookingId: null, invoiceNumber: null,
  customer: { name: 'Jane Doe', email: 'jane@example.com', phone: null, address: null, postcode: null },
  poReference: null, issueDate: null, dueDate: null, serviceDate: null, bookingRefSnapshot: null,
  currency: 'GBP', subtotal: 100, documentDiscount: 0, taxTotal: 0, total: 100,
  depositApplied: 0, amountPaid: 0, amountDue: 100,
  customerNotes: null, internalNotes: null, paymentTerms: 'Payment due within 14 days.',
  documentStatus: 'draft', paymentStatus: 'unpaid', voidReason: null,
  createdByAdminId: 'admin-1', issuedByAdminId: null, documentVersion: 1, duplicatedFromId: null,
  revisedFromInvoiceId: null, revisedFromInvoiceNumber: null, revisedFromIssueDate: null,
  supersededByInvoiceId: null, supersededAt: null,
  paymentOption: 'bank_transfer', stripePaymentLinkUrl: null, serviceContact: null,
  invoiceRecipientEmail: null, receiptRecipientEmail: null, billingCustomerId: null, serviceCustomerId: null,
  createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z',
  issuedAt: null, sentAt: null, paidAt: null, voidAt: null,
  items: [{ id: 'item-1', description: 'Deep clean', quantity: 1, unitPrice: 100, lineDiscount: 0, lineTotal: 100, sortOrder: 0 }],
  payments: [],
};

const issuedInvoice = {
  ...draftInvoice,
  invoiceNumber: 'INV-2026-000001',
  documentStatus: 'issued',
  issueDate: '2026-07-16',
  dueDate: '2026-07-30',
  issuedAt: '2026-07-16T00:00:00.000Z',
};

function mockRouteBasedFetch(invoice: typeof draftInvoice, events: unknown[] = [], receipts: Array<Record<string, unknown>> = []) {
  authFetchMock.mockImplementation((path: string) => {
    if (path.includes('action=events')) return Promise.resolve({ results: events });
    if (path.startsWith('/api/receipts')) return Promise.resolve({ results: receipts, page: 1, pageSize: 1, totalCount: receipts.length, hasMore: false });
    return Promise.resolve(invoice);
  });
}

describe('InvoiceDetailPage — draft', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    authFetchBlobMock.mockReset();
  });

  it('renders the editable line-item form with a DRAFT notice', async () => {
    mockRouteBasedFetch(draftInvoice);
    renderDetail();
    expect(await screen.findByText(/no formal number is allocated yet/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Deep clean')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issue invoice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete draft/i })).toBeInTheDocument();
  });

  it('issuing shows an inline confirmation before calling the API', async () => {
    mockRouteBasedFetch(draftInvoice);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByDisplayValue('Jane Doe');

    await user.click(screen.getByRole('button', { name: /issue invoice/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

    const issueCallsBefore = authFetchMock.mock.calls.filter((c) => (c[0] as string).includes('action=issue')).length;
    expect(issueCallsBefore).toBe(0);
  });

  it('confirming issue calls POST /issue', async () => {
    mockRouteBasedFetch(draftInvoice);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByDisplayValue('Jane Doe');

    await user.click(screen.getByRole('button', { name: /issue invoice/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /issue invoice/i }));

    await waitFor(() => {
      const issueCalls = authFetchMock.mock.calls.filter((c) => (c[0] as string).includes('action=issue'));
      expect(issueCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('blocks issuing/previewing unsaved edits and sends the current version only after saving them', async () => {
    let current = draftInvoice;
    authFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.includes('action=events')) return Promise.resolve({ results: [] });
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string);
        expect(body.expectedUpdatedAt).toBe(draftInvoice.updatedAt);
        current = { ...current, updatedAt: '2026-09-13T12:00:00.000Z',
          items: [{ ...current.items[0], unitPrice: body.items[0].unitPrice }] };
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve(current);
    });
    const user = userEvent.setup();
    renderDetail();
    const price = await screen.findByLabelText('Unit price (£)');
    await user.clear(price);
    await user.type(price, '145');
    expect(screen.getByRole('button', { name: /issue invoice/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /preview pdf/i })).toBeDisabled();
    expect(screen.getByText(/Save your changes before previewing or issuing/)).toBeInTheDocument();
    expect(authFetchMock.mock.calls.some((call) => String(call[0]).includes('action=issue'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /issue invoice/i })).toBeEnabled());
    expect(screen.getByLabelText('Unit price (£)')).toHaveValue('145');
    expect(window.sessionStorage.length).toBe(0);
    await user.click(screen.getByRole('button', { name: /issue invoice/i }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /issue invoice/i }));
    await waitFor(() => {
      const call = authFetchMock.mock.calls.find((entry) => String(entry[0]).includes('action=issue'));
      expect(JSON.parse(call![1].body as string)).toEqual({ expectedUpdatedAt: current.updatedAt });
    });
  });

  it('restores unsaved edits on the same draft after remounting and blocks issuing the saved older amount', async () => {
    mockRouteBasedFetch(draftInvoice);
    const first = renderDetail();
    fireEvent.change(await screen.findByLabelText('Unit price (£)'), { target: { value: '145.' } });
    first.unmount();
    renderDetail();
    expect(await screen.findByLabelText('Unit price (£)')).toHaveValue('145.');
    expect(screen.getByRole('status')).toHaveTextContent('Recovered');
    expect(screen.getByRole('button', { name: /issue invoice/i })).toBeDisabled();
  });

  it('keeps edits on a version conflict and requires review before another save or issue', async () => {
    authFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.includes('action=events')) return Promise.resolve({ results: [] });
      if (init?.method === 'PATCH') return Promise.reject(new ApiError(409, 'This invoice changed. Reload it before saving.'));
      return Promise.resolve(draftInvoice);
    });
    const user = userEvent.setup();
    renderDetail();
    fireEvent.change(await screen.findByLabelText('Unit price (£)'), { target: { value: '145' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Copy any changes you need/)).toBeInTheDocument();
    expect(screen.getByLabelText('Unit price (£)')).toHaveValue('145');
    expect(window.sessionStorage.length).toBe(1);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /issue invoice/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload saved invoice' })).toBeEnabled();
  });

  it('does not restore edits into an invoice that has now been issued', async () => {
    mockRouteBasedFetch(draftInvoice);
    const first = renderDetail();
    fireEvent.change(await screen.findByLabelText('Unit price (£)'), { target: { value: '145' } });
    first.unmount();
    mockRouteBasedFetch(issuedInvoice);
    renderDetail();
    expect(await screen.findByText('INV-2026-000001')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unit price (£)')).not.toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
  });

});

describe('InvoiceDetailPage — issued', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    authFetchBlobMock.mockReset();
  });

  it('renders a read-only view with the invoice number and action buttons', async () => {
    mockRouteBasedFetch(issuedInvoice, [{ id: 'e1', eventType: 'issued', adminId: 'admin-1', metadata: null, createdAt: '2026-07-16T00:00:00.000Z' }]);
    renderDetail();

    expect(await screen.findByText('INV-2026-000001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^download$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^send$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /void invoice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /correct customer or address details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adjust services or price/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create similar invoice/i })).toBeInTheDocument();
  });

  it('corrects an email typo in place and sends only contact fields to ?action=correctDetails', async () => {
    mockRouteBasedFetch(issuedInvoice);
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /correct customer or address details/i }));
    const dialog = await screen.findByRole('dialog', { name: /correct customer or address details/i });
    const email = within(dialog).getAllByLabelText(/^email$/i)[0];
    await user.clear(email);
    await user.type(email, 'jane@example.co.uk');
    await user.click(within(dialog).getByRole('button', { name: /save correction.*regenerate pdf/i }));

    await waitFor(() => {
      const calls = authFetchMock.mock.calls.filter((call) => (call[0] as string).includes('action=correctDetails'));
      expect(calls).toHaveLength(1);
      const payload = JSON.parse((calls[0][1] as RequestInit).body as string);
      expect(payload.customer.email).toBe('jane@example.co.uk');
      expect(payload).not.toHaveProperty('items');
      expect(payload).not.toHaveProperty('total');
    });
  });

  it('explains that service or price changes use a preserved revised draft', async () => {
    mockRouteBasedFetch(issuedInvoice);
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /adjust services or price/i }));
    const dialog = await screen.findByRole('dialog', { name: /adjust services or price/i });
    expect(within(dialog).getByText(/original invoice will remain preserved/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/nothing will be sent/i)).toBeInTheDocument();
  });

  it('does not render the draft edit form for an issued invoice', async () => {
    mockRouteBasedFetch(issuedInvoice);
    renderDetail();
    await screen.findByText('INV-2026-000001');
    expect(screen.queryByDisplayValue('Jane Doe')).not.toBeInTheDocument();
  });

  it('shows the payment history section with recorded payments', async () => {
    const paidInvoice = {
      ...issuedInvoice,
      amountPaid: 50,
      amountDue: 50,
      paymentStatus: 'partially_paid',
      payments: [{ id: 'p1', amount: 50, paymentDate: '2026-07-16', method: 'card', reference: null, notes: null, createdByAdminId: 'admin-1', createdAt: '2026-07-16T00:00:00.000Z', reversedAt: null, reversedByAdminId: null, reversalReason: null }],
    };
    mockRouteBasedFetch(paidInvoice);
    renderDetail();
    expect(await screen.findByText(/£50\.00 · card/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reverse/i })).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no payments yet', async () => {
    mockRouteBasedFetch(issuedInvoice);
    renderDetail();
    expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument();
  });

  it('shows "Send payment reminder" while there is an outstanding balance', async () => {
    mockRouteBasedFetch(issuedInvoice); // amountDue: 100, inherited from draftInvoice
    renderDetail();
    expect(await screen.findByRole('button', { name: /send payment reminder/i })).toBeInTheDocument();
  });

  it('sending a payment reminder shows the recipient/invoice/service/amount/date summary and calls ?action=remind', async () => {
    mockRouteBasedFetch(issuedInvoice);
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /send payment reminder/i }));
    const dialog = await screen.findByRole('dialog', { name: /send payment reminder/i });
    expect(within(dialog).getByText('INV-2026-000001')).toBeInTheDocument();
    expect(within(dialog).getByText('Deep clean')).toBeInTheDocument();
    expect(within(dialog).getByText('£100.00')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-07-30')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /send reminder/i }));

    await waitFor(() => {
      const remindCalls = authFetchMock.mock.calls.filter((c) => (c[0] as string).includes('action=remind'));
      expect(remindCalls.length).toBeGreaterThanOrEqual(1);
      expect(remindCalls[0][1]).toEqual(expect.objectContaining({ method: 'POST' }));
    });
  });

  it('once fully paid: hides Send/Resend and "Send payment reminder", and links to the receipt instead', async () => {
    const paidInvoice = { ...issuedInvoice, amountPaid: 100, amountDue: 0, paymentStatus: 'paid' };
    mockRouteBasedFetch(paidInvoice, [], [{ id: 'rec-1', receiptNumber: 'REC-2026-000001', customerName: 'Jane Doe', totalPaid: 100, paymentDate: '2026-07-20', createdAt: '2026-07-20T00:00:00.000Z' }]);
    renderDetail();

    const receiptLink = await screen.findByRole('link', { name: /view.*send receipt/i });
    expect(receiptLink).toHaveAttribute('href', '/receipts/rec-1');
    expect(screen.queryByRole('button', { name: /^send$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^resend$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send payment reminder/i })).not.toBeInTheDocument();
  });

  it('recording a partial payment with the acknowledgement checkbox ticked sends ?action=paymentAck with the new paymentId', async () => {
    authFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.includes('action=events')) return Promise.resolve({ results: [] });
      if (path.includes('action=payments')) {
        return Promise.resolve({ ok: true, paymentId: 'payment-1', amountPaid: 40, amountDue: 60, paymentStatus: 'partially_paid', receiptId: null });
      }
      if (path.includes('action=paymentAck')) return Promise.resolve({ ok: true, to: 'jane@example.com' });
      void init;
      return Promise.resolve(issuedInvoice);
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /record payment/i }));
    const dialog = await screen.findByRole('dialog', { name: /record payment/i });
    await user.clear(within(dialog).getByLabelText(/amount/i));
    await user.type(within(dialog).getByLabelText(/amount/i), '40');
    await user.click(within(dialog).getByLabelText(/send payment acknowledgement email/i));
    await user.click(within(dialog).getByRole('button', { name: /^record payment$/i }));

    await waitFor(() => {
      const ackCalls = authFetchMock.mock.calls.filter((c) => (c[0] as string).includes('action=paymentAck'));
      expect(ackCalls.length).toBe(1);
      expect(JSON.parse((ackCalls[0][1] as RequestInit).body as string)).toEqual({ paymentId: 'payment-1' });
    });
  });

  it('does not send an acknowledgement email when the checkbox is left unticked', async () => {
    authFetchMock.mockImplementation((path: string) => {
      if (path.includes('action=events')) return Promise.resolve({ results: [] });
      if (path.includes('action=payments')) {
        return Promise.resolve({ ok: true, paymentId: 'payment-1', amountPaid: 40, amountDue: 60, paymentStatus: 'partially_paid', receiptId: null });
      }
      return Promise.resolve(issuedInvoice);
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /record payment/i }));
    const dialog = await screen.findByRole('dialog', { name: /record payment/i });
    await user.clear(within(dialog).getByLabelText(/amount/i));
    await user.type(within(dialog).getByLabelText(/amount/i), '40');
    await user.click(within(dialog).getByRole('button', { name: /^record payment$/i }));

    await waitFor(() => {
      expect(authFetchMock.mock.calls.some((c) => (c[0] as string).includes('action=payments'))).toBe(true);
    });
    expect(authFetchMock.mock.calls.some((c) => (c[0] as string).includes('action=paymentAck'))).toBe(false);
  });
});

describe('InvoiceDetailPage — not found / error', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    authFetchBlobMock.mockReset();
  });

  it('shows a not-found state for a 404', async () => {
    authFetchMock.mockRejectedValue(new ApiError(404, 'Invoice not found'));
    renderDetail();
    expect(await screen.findByText('Invoice not found')).toBeInTheDocument();
  });

  it('shows a retryable error state for a 500', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Server error'));
    renderDetail();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
