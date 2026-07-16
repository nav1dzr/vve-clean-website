import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InvoiceEditorPage from './InvoiceEditorPage';

const { authFetchMock, navigateMock } = vi.hoisted(() => ({ authFetchMock: vi.fn(), navigateMock: vi.fn() }));

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

function renderEditor(initialEntries = ['/invoices/new']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/invoices/new" element={<InvoiceEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InvoiceEditorPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it('renders an empty form with no prefill when there is no bookingId', () => {
    renderEditor();
    expect(screen.getByLabelText('Name *')).toHaveValue('');
  });

  it('prefills customer and a single line item from the booking when ?bookingId= is present', async () => {
    authFetchMock.mockResolvedValue({
      id: 'booking-1', fullName: 'Jane Doe', email: 'jane@example.com', phone: '07700900000',
      address: '1 Test St', postcode: 'N15 2NG', service: 'End of tenancy clean',
      totalPrice: 250, depositAmount: 30, serviceDate: '2026-07-20', bookingRef: 'N152NG160726',
    });
    renderEditor(['/invoices/new?bookingId=booking-1']);

    expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('End of tenancy clean')).toBeInTheDocument();
    expect(screen.getByDisplayValue('250')).toBeInTheDocument();
  });

  it('submits a POST to /api/invoices and navigates to the created invoice', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ id: 'new-invoice-id', documentStatus: 'draft' });
    renderEditor();

    await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.type(screen.getByLabelText('Description'), 'Deep clean');
    const qtyInput = screen.getByLabelText('Qty');
    await user.clear(qtyInput);
    await user.type(qtyInput, '1');
    const priceInput = screen.getByLabelText('Unit price (£)');
    await user.clear(priceInput);
    await user.type(priceInput, '100');

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const postCall = authFetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect(postCall?.[0]).toBe('/api/invoices');
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/invoices/new-invoice-id', { replace: true }));
  });

  it('shows a validation error and does not submit when the customer has no email or phone', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/email or phone/i);
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});
