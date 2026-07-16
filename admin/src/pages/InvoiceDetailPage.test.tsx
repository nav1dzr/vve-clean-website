import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InvoiceDetailPage from './InvoiceDetailPage';
import { ApiError } from '../lib/authFetch';
import type { InvoiceDetail } from '../types/invoice';

const { authFetchMock, authFetchBlobMock } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
  authFetchBlobMock: vi.fn(),
}));

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

function mockRouteBasedFetch(invoice: typeof draftInvoice, events: unknown[] = []) {
  authFetchMock.mockImplementation((path: string) => {
    if (/\/events$/.test(path)) return Promise.resolve({ results: events });
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

    const issueCallsBefore = authFetchMock.mock.calls.filter((c) => /\/issue$/.test(c[0] as string)).length;
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
      const issueCalls = authFetchMock.mock.calls.filter((c) => /\/issue$/.test(c[0] as string));
      expect(issueCalls.length).toBeGreaterThanOrEqual(1);
    });
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
    expect(screen.getByRole('button', { name: /^void$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /duplicate as corrected draft/i })).toBeInTheDocument();
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
