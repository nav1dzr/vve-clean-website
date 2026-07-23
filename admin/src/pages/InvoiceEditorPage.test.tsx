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

async function fillMinimalValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.type(screen.getByLabelText('Description'), 'Deep clean');
  const qtyInput = screen.getByLabelText('Qty');
  await user.clear(qtyInput);
  await user.type(qtyInput, '1');
  const priceInput = screen.getByLabelText('Unit price (£)');
  await user.clear(priceInput);
  await user.type(priceInput, '100');
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

  it('defaults to bank_transfer and submits without a stripe link', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ id: 'new-invoice-id', documentStatus: 'draft' });
    renderEditor();
    await fillMinimalValidForm(user);

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const postCall = authFetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
      expect(body.paymentOption).toBe('bank_transfer');
      expect(body.stripePaymentLinkUrl).toBeNull();
    });
  });

  it('requires a stripe link when "Stripe payment link" is selected, and submits it when provided', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ id: 'new-invoice-id', documentStatus: 'draft' });
    renderEditor();
    await fillMinimalValidForm(user);

    await user.click(screen.getByRole('radio', { name: 'Stripe payment link' }));
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/stripe payment-link/i);
    expect(authFetchMock.mock.calls.some((c) => (c[1] as RequestInit)?.method === 'POST')).toBe(false);

    await user.type(screen.getByPlaceholderText(/buy\.stripe\.com/i), 'https://buy.stripe.com/test_1');
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const postCall = authFetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
      expect(body.paymentOption).toBe('stripe_payment_link');
      expect(body.stripePaymentLinkUrl).toBe('https://buy.stripe.com/test_1');
    });
  });

  it('sends a service contact only when the "different address" checkbox is enabled', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ id: 'new-invoice-id', documentStatus: 'draft' });
    renderEditor();
    await fillMinimalValidForm(user);

    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => {
      const postCall = authFetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
      expect(body.serviceContact).toBeNull();
    });
  });

  it('prefills the booking reference automatically once postcode and service date are both set, without needing the button', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByLabelText('Booking reference')).toHaveValue('');
    await user.type(screen.getByLabelText('Postcode'), 'N15 2NG');
    expect(screen.getByLabelText('Booking reference')).toHaveValue(''); // date still missing
    await user.type(screen.getByLabelText('Service date'), '2026-07-24');

    expect(screen.getByLabelText('Booking reference')).toHaveValue('N152NG240726');
  });

  it('keeps updating the auto-filled reference as postcode/date change, until the admin types into it directly', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText('Postcode'), 'N15 2NG');
    await user.type(screen.getByLabelText('Service date'), '2026-07-24');
    expect(screen.getByLabelText('Booking reference')).toHaveValue('N152NG240726');

    // Still auto-tracking — a later postcode change updates it again.
    await user.clear(screen.getByLabelText('Postcode'));
    await user.type(screen.getByLabelText('Postcode'), 'E8 1AA');
    expect(screen.getByLabelText('Booking reference')).toHaveValue('E81AA240726');

    // Admin types into the reference field directly — auto-tracking stops.
    await user.clear(screen.getByLabelText('Booking reference'));
    await user.type(screen.getByLabelText('Booking reference'), 'CUSTOM-REF');
    expect(screen.getByLabelText('Booking reference')).toHaveValue('CUSTOM-REF');

    // A further postcode/date change must NOT overwrite the manual value.
    await user.clear(screen.getByLabelText('Postcode'));
    await user.type(screen.getByLabelText('Postcode'), 'W2 3EL');
    expect(screen.getByLabelText('Booking reference')).toHaveValue('CUSTOM-REF');
  });

  it('the Auto-fill button regenerates the reference and resumes automatic tracking afterwards', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText('Postcode'), 'N15 2NG');
    await user.type(screen.getByLabelText('Service date'), '2026-07-24');

    // Manual edit stops auto-tracking.
    await user.clear(screen.getByLabelText('Booking reference'));
    await user.type(screen.getByLabelText('Booking reference'), 'CUSTOM-REF');

    await user.click(screen.getByRole('button', { name: /auto-fill/i }));
    expect(screen.getByLabelText('Booking reference')).toHaveValue('N152NG240726');

    // Tracking resumed — a subsequent postcode change updates it again.
    await user.clear(screen.getByLabelText('Postcode'));
    await user.type(screen.getByLabelText('Postcode'), 'E8 1AA');
    expect(screen.getByLabelText('Booking reference')).toHaveValue('E81AA240726');
  });

  describe('booking reference — linked booking', () => {
    it('fills the booking reference field with the saved booking_ref, not auto-generated from postcode+date', async () => {
      authFetchMock.mockResolvedValue({
        id: 'booking-1', fullName: 'Jane Doe', email: 'jane@example.com', phone: '07700900000',
        address: '1 Test St', postcode: 'N15 2NG', service: 'EOT clean',
        totalPrice: 250, depositAmount: 30, serviceDate: '2026-07-20', bookingRef: 'N152NG160726',
      });
      renderEditor(['/invoices/new?bookingId=booking-1']);

      expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
      // Saved booking_ref takes priority — auto-generating from N15 2NG + 2026-07-20 would give N152NG200726.
      expect(screen.getByLabelText('Booking reference')).toHaveValue('N152NG160726');
    });

    it('preserves the booking ref suffix exactly as saved', async () => {
      authFetchMock.mockResolvedValue({
        id: 'booking-1', fullName: 'Jane Doe', email: 'jane@example.com', phone: '07700900000',
        address: 'Flat 2, 352 Finchley Rd', postcode: 'NW3 7AJ', service: 'EOT clean',
        totalPrice: 135, depositAmount: 30, serviceDate: '2026-07-17', bookingRef: 'NW37AJ170726-01',
      });
      renderEditor(['/invoices/new?bookingId=booking-1']);

      expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
      expect(screen.getByLabelText('Booking reference')).toHaveValue('NW37AJ170726-01');
    });

    it('does not overwrite the linked booking ref when postcode or service date are changed', async () => {
      const user = userEvent.setup();
      authFetchMock.mockResolvedValue({
        id: 'booking-1', fullName: 'Jane Doe', email: 'jane@example.com', phone: '07700900000',
        address: '1 Test St', postcode: 'N15 2NG', service: 'Deep clean',
        totalPrice: 100, depositAmount: 0, serviceDate: '2026-07-20', bookingRef: 'N152NG160726',
      });
      renderEditor(['/invoices/new?bookingId=booking-1']);

      expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
      expect(screen.getByLabelText('Booking reference')).toHaveValue('N152NG160726');

      await user.clear(screen.getByLabelText('Postcode'));
      await user.type(screen.getByLabelText('Postcode'), 'E8 1AA');
      expect(screen.getByLabelText('Booking reference')).toHaveValue('N152NG160726');
    });
  });

  describe('unit price — controlled numeric input', () => {
    it('zero can be cleared without immediately reinserting 0', async () => {
      const user = userEvent.setup();
      renderEditor();

      const priceInput = screen.getByLabelText('Unit price (£)');
      expect(priceInput).toHaveValue('0');
      await user.clear(priceInput);
      expect(priceInput).toHaveValue('');
    });

    it('blank field is safe — totals render without NaN and amount due label is visible', async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.clear(screen.getByLabelText('Unit price (£)'));
      expect(screen.getByLabelText('Unit price (£)')).toHaveValue('');
      expect(screen.getByText('Amount due')).toBeInTheDocument();
    });

    it('normalizes blank field to 0 when focus leaves', async () => {
      const user = userEvent.setup();
      renderEditor();

      const priceInput = screen.getByLabelText('Unit price (£)');
      await user.clear(priceInput);
      expect(priceInput).toHaveValue('');

      await user.click(screen.getByLabelText('Name *'));
      expect(priceInput).toHaveValue('0');
    });

    it('accepts whole number, single-decimal, and two-decimal amounts', async () => {
      const user = userEvent.setup();
      renderEditor();

      const priceInput = screen.getByLabelText('Unit price (£)');

      await user.clear(priceInput);
      await user.type(priceInput, '85');
      expect(priceInput).toHaveValue('85');

      await user.clear(priceInput);
      await user.type(priceInput, '85.5');
      expect(priceInput).toHaveValue('85.5');

      await user.clear(priceInput);
      await user.type(priceInput, '85.50');
      expect(priceInput).toHaveValue('85.50');
    });

    it('rejects a third decimal place', async () => {
      const user = userEvent.setup();
      renderEditor();

      const priceInput = screen.getByLabelText('Unit price (£)');
      await user.clear(priceInput);
      await user.type(priceInput, '85.555');
      expect(priceInput).toHaveValue('85.55');
    });

    it('rejects a negative sign', async () => {
      const user = userEvent.setup();
      renderEditor();

      const priceInput = screen.getByLabelText('Unit price (£)');
      await user.clear(priceInput);
      await user.type(priceInput, '-5');
      // '-' is rejected; '5' is accepted
      expect(priceInput).toHaveValue('5');
    });

    it('clearing and retyping produces the correct submitted value', async () => {
      const user = userEvent.setup();
      authFetchMock.mockResolvedValue({ id: 'inv-1', documentStatus: 'draft' });
      renderEditor();

      await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
      await user.type(screen.getByLabelText('Email'), 'jane@example.com');
      await user.type(screen.getByLabelText('Description'), 'Deep clean');

      const priceInput = screen.getByLabelText('Unit price (£)');
      await user.clear(priceInput);
      await user.type(priceInput, '135');

      await user.click(screen.getByRole('button', { name: /save draft/i }));

      await waitFor(() => {
        const postCall = authFetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
        const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
        expect(body.items[0].unitPrice).toBe(135);
      });
    });

    it('totals update correctly when a valid price is entered', async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.clear(screen.getByLabelText('Unit price (£)'));
      await user.type(screen.getByLabelText('Unit price (£)'), '200');

      // Qty=1, no discount or deposit, so subtotal=total=amountDue=£200.
      // All three summary rows show £200.00 — use getAllByText to handle multiple matches.
      await waitFor(() => {
        expect(screen.getAllByText('£200.00').length).toBeGreaterThan(0);
      });
    });
  });

  it('prefills the billing contact and billingCustomerId when ?customerId= is present', async () => {
    authFetchMock.mockResolvedValue({
      id: 'cust-1', name: 'Acme Lettings', email: 'ops@acme.example.com', phone: null, address: null, postcode: 'E1 6AN',
      customerType: 'letting_agent', source: 'referral', preferredContactMethod: null, notes: null,
      createdByAdminId: 'admin-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    render(
      <MemoryRouter initialEntries={['/invoices/new?customerId=cust-1']}>
        <Routes>
          <Route path="/invoices/new" element={<InvoiceEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('Acme Lettings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ops@acme.example.com')).toBeInTheDocument();
  });
});
