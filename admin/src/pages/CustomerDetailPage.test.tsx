import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import CustomerDetailPage from './CustomerDetailPage';
import { ApiError } from '../lib/authFetch';

const { authFetchMock, navigateMock } = vi.hoisted(() => ({ authFetchMock: vi.fn(), navigateMock: vi.fn() }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ admin: { id: 'owner-manual-test' } }) }));

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

function renderDetail(id = 'cust-1') {
  return render(
    <MemoryRouter initialEntries={[`/customers/${id}`]}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseCustomer = {
  id: 'cust-1', name: 'Jane Doe', email: 'jane@example.com', phone: '07700900123', address: '1 Test St', postcode: 'N15 2NG',
  customerType: 'individual', source: 'website', preferredContactMethod: 'email', notes: null,
  createdByAdminId: 'admin-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  bookings: [], invoices: [], receipts: [], outstandingBalance: 0, totalPaid: 0,
};

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it('shows a not-found state for a 404', async () => {
    authFetchMock.mockRejectedValue(new ApiError(404, 'Customer not found'));
    renderDetail();
    expect(await screen.findByText('Customer not found')).toBeInTheDocument();
  });

  it('shows a retryable error state for a 500', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Server error'));
    renderDetail();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('retries a failed history read without showing fabricated zero balances', async () => {
    const user = userEvent.setup();
    authFetchMock.mockRejectedValueOnce(new ApiError(503, 'Could not load customer invoices and balances. Please try again.'));
    renderDetail();
    await screen.findByRole('alert');
    expect(screen.queryByText('Outstanding balance')).not.toBeInTheDocument();
    authFetchMock.mockResolvedValueOnce({ ...baseCustomer, outstandingBalance: 125 });
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('£125.00')).toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a late detail response after navigating to a different customer', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: unknown) => void;
    authFetchMock.mockImplementation((url: string) => url.endsWith('/cust-1')
      ? new Promise((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ ...baseCustomer, id: 'cust-2', name: 'Current customer' }));
    render(<MemoryRouter initialEntries={['/customers/cust-1']}><Link to="/customers/cust-2">Next customer</Link><Routes><Route path="/customers/:id" element={<CustomerDetailPage />} /></Routes></MemoryRouter>);
    await user.click(screen.getByRole('link', { name: 'Next customer' }));
    await screen.findByRole('heading', { name: 'Current customer' });
    await act(async () => { resolveFirst(baseCustomer); });
    expect(screen.queryByRole('heading', { name: 'Jane Doe' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create invoice/i })).toHaveAttribute('href', '/invoices/new?customerId=cust-2');
  });

  it('renders contact details, balances, and enabled quick actions', async () => {
    authFetchMock.mockResolvedValue(baseCustomer);
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:07700900123');
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:jane@example.com');
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me'));
  });

  it('disables Call/WhatsApp/Email when no phone/email is on file', async () => {
    authFetchMock.mockResolvedValue({ ...baseCustomer, phone: null, email: null });
    renderDetail();
    await screen.findByRole('heading', { name: 'Jane Doe' });

    expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Email' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeDisabled();
  });

  it('links to the invoice editor prefilled with this customer', async () => {
    authFetchMock.mockResolvedValue(baseCustomer);
    renderDetail();
    await screen.findByRole('heading', { name: 'Jane Doe' });
    expect(screen.getByRole('link', { name: /create invoice/i })).toHaveAttribute('href', '/invoices/new?customerId=cust-1');
  });

  it('keeps duplicate warnings visible on the saved customer and lets the owner dismiss them', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue(baseCustomer);
    render(<MemoryRouter initialEntries={[{ pathname: '/customers/cust-1', state: { duplicateWarnings: [{ type: 'email', customer: { id: 'existing-1', name: 'Existing customer' } }] } }]}><Routes><Route path="/customers/:id" element={<CustomerDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Customer saved — possible duplicate');
    expect(screen.getByRole('link', { name: 'Existing customer' })).toHaveAttribute('href', '/customers/existing-1');
    expect(screen.getByText(/Nothing was merged/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss duplicate warning' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows empty-state messages for bookings/invoices/receipts when there is no history', async () => {
    authFetchMock.mockResolvedValue(baseCustomer);
    renderDetail();
    await screen.findByRole('heading', { name: 'Jane Doe' });
    expect(screen.getByText(/no bookings matched/i)).toBeInTheDocument();
    expect(screen.getByText(/no invoices for this customer/i)).toBeInTheDocument();
    expect(screen.getByText(/no receipts for this customer/i)).toBeInTheDocument();
  });

  it('renders booking/invoice/receipt history when present', async () => {
    authFetchMock.mockResolvedValue({
      ...baseCustomer,
      bookings: [{ id: 'b-1', bookingRef: 'N152NG010826', fullName: 'Jane', service: 'Deep clean', status: 'new', paymentStatus: 'paid', balanceStatus: 'not_due', totalPrice: 200, createdAt: '2026-01-01T00:00:00Z' }],
      invoices: [{ id: 'inv-1', invoiceNumber: 'INV-2026-000001', customerName: 'Jane', total: 100, amountDue: 40, documentStatus: 'issued', paymentStatus: 'partially_paid', dueDate: null, issueDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' }],
      receipts: [{ id: 'r-1', receiptNumber: 'REC-2026-000001', customerName: 'Jane', totalPaid: 60, paymentDate: '2026-01-05', createdAt: '2026-01-05T00:00:00Z' }],
      outstandingBalance: 40, totalPaid: 60,
    });
    renderDetail();

    expect(await screen.findByText('N152NG010826')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('REC-2026-000001')).toBeInTheDocument();
  });

  it('opens the manual booking modal and creates a booking, then navigates to it', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce(baseCustomer);
    renderDetail();
    await screen.findByRole('heading', { name: 'Jane Doe' });

    await user.click(screen.getByRole('button', { name: /create booking/i }));
    const dialog = await screen.findByRole('dialog');

    authFetchMock.mockResolvedValueOnce({ ok: true, bookingId: 'new-booking-id', bookingRef: 'N152NG010826' });
    await user.type(within(dialog).getByLabelText(/service \*/i), 'Deep clean');
    await user.selectOptions(within(dialog).getByLabelText(/Payment arrangement/), 'after_clean');
    await user.click(within(dialog).getByRole('button', { name: /^create booking$/i }));

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith('/api/customers/cust-1?action=bookings', expect.objectContaining({ method: 'POST' }));
      expect(navigateMock).toHaveBeenCalledWith('/bookings/new-booking-id');
    });
  });

  it('does not navigate away from a new customer when an earlier manual booking finishes', async () => {
    const user = userEvent.setup();
    let finish!: (value: unknown) => void;
    authFetchMock.mockImplementation((url: string, options?: { method?: string }) => options?.method === 'POST'
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve(url.endsWith('cust-2') ? { ...baseCustomer, id: 'cust-2', name: 'Current customer' } : baseCustomer));
    render(<MemoryRouter initialEntries={['/customers/cust-1']}><Link to="/customers/cust-2">Next customer</Link><Routes><Route path="/customers/:id" element={<CustomerDetailPage />} /></Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Jane Doe' });
    await user.click(screen.getByRole('button', { name: /create booking/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/service \*/i), 'Carpet cleaning');
    await user.selectOptions(within(dialog).getByLabelText(/Payment arrangement/), 'after_clean');
    await user.click(within(dialog).getByRole('button', { name: /^create booking$/i }));
    await user.click(screen.getByRole('link', { name: 'Next customer' }));
    await screen.findByRole('heading', { name: 'Current customer' });
    await act(async () => finish({ ok: true, bookingId: 'old-booking' }));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
