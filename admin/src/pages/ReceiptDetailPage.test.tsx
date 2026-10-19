import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ReceiptDetailPage from './ReceiptDetailPage';
import { ApiError } from '../lib/authFetch';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));

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

function renderDetail(id = 'rec-1') {
  return render(
    <MemoryRouter initialEntries={[`/receipts/${id}`]}>
      <Routes>
        <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const receipt = {
  id: 'rec-1', receiptNumber: 'REC-2026-000001', invoiceId: 'inv-1', bookingId: null,
  customer: { name: 'Jane Doe', email: 'jane@example.com', phone: null, address: null, postcode: null },
  invoiceNumberSnapshot: 'INV-2026-000001', invoiceTotal: 150, totalPaid: 150,
  paymentDate: '2026-07-16', paymentMethod: 'card', paymentReference: null,
  createdByAdminId: 'admin-1', documentVersion: 1, createdAt: '2026-07-16T00:00:00.000Z', sentAt: null,
};

function mockRouteBasedFetch() {
  authFetchMock.mockImplementation((path: string) => {
    if (/action=events/.test(path)) return Promise.resolve({ results: [] });
    return Promise.resolve(receipt);
  });
}

describe('ReceiptDetailPage', () => {
  beforeEach(() => { authFetchMock.mockReset(); });

  it('renders the receipt number, invoice reference, and paid-in-full badge', async () => {
    mockRouteBasedFetch();
    renderDetail();
    expect(await screen.findByText('REC-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Paid in full')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-000001')).toBeInTheDocument();
  });

  it('links back to the originating invoice', async () => {
    mockRouteBasedFetch();
    renderDetail();
    await screen.findByText('REC-2026-000001');
    expect(screen.getByRole('link', { name: /view invoice/i })).toHaveAttribute('href', '/invoices/inv-1');
  });

  it('shows a not-found state for a 404', async () => {
    authFetchMock.mockRejectedValue(new ApiError(404, 'Receipt not found'));
    renderDetail();
    expect(await screen.findByText('Receipt not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('distinguishes a failed history load from an empty history and offers a working retry', async () => {
    const user = userEvent.setup();
    authFetchMock.mockImplementation((url: string) => url.includes('action=events')
      ? Promise.reject(new ApiError(503, 'History temporarily unavailable'))
      : Promise.resolve(receipt));
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent('History temporarily unavailable');
    expect(screen.queryByText('No history yet.')).not.toBeInTheDocument();
    mockRouteBasedFetch();
    await user.click(screen.getByRole('button', { name: 'Retry history' }));
    expect(await screen.findByText('No history yet.')).toBeInTheDocument();
    expect(authFetchMock.mock.calls.filter(([url]) => url.includes('action=events'))).toHaveLength(2);
  });

  it('ignores a late receipt response after changing routes', async () => {
    const user = userEvent.setup();
    let finishFirst!: (value: unknown) => void;
    authFetchMock.mockImplementation((url: string) => {
      if (url.includes('action=events')) return Promise.resolve({ results: [] });
      if (url.includes('id=rec-1')) return new Promise((resolve) => { finishFirst = resolve; });
      return Promise.resolve({ ...receipt, id: 'rec-2', receiptNumber: 'REC-2026-000002', invoiceId: 'inv-2' });
    });
    render(<MemoryRouter initialEntries={['/receipts/rec-1']}><Link to="/receipts/rec-2">Next receipt</Link><Routes><Route path="/receipts/:id" element={<ReceiptDetailPage />} /></Routes></MemoryRouter>);
    await user.click(screen.getByRole('link', { name: 'Next receipt' }));
    await screen.findByText('REC-2026-000002');
    await act(async () => { finishFirst(receipt); });
    expect(screen.queryByText('REC-2026-000001')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view invoice/i })).toHaveAttribute('href', '/invoices/inv-2');
  });

  it('ignores an old receipt history response and closes its send modal when the route changes', async () => {
    const user = userEvent.setup();
    let finishHistory!: (value: unknown) => void;
    authFetchMock.mockImplementation((url: string) => {
      if (url.includes('id=rec-1') && url.includes('action=events')) return new Promise((resolve) => { finishHistory = resolve; });
      if (url.includes('action=events')) return Promise.resolve({ results: [] });
      return Promise.resolve(url.includes('id=rec-1') ? receipt : { ...receipt, id: 'rec-2', receiptNumber: 'REC-2026-000002' });
    });
    render(<MemoryRouter initialEntries={['/receipts/rec-1']}><Link to="/receipts/rec-2">Next receipt</Link><Routes><Route path="/receipts/:id" element={<ReceiptDetailPage />} /></Routes></MemoryRouter>);
    await screen.findByText('REC-2026-000001');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Next receipt' }));
    await screen.findByText('REC-2026-000002');
    await act(async () => { finishHistory({ results: [{ id: 'event-old', eventType: 'sent', createdAt: '2026-07-16T00:00:00Z' }] }); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('No history yet.')).toBeInTheDocument();
  });
});
