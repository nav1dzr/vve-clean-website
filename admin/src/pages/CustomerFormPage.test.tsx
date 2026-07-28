import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CustomerFormPage from './CustomerFormPage';

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

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/customers/new']}>
      <Routes>
        <Route path="/customers/new" element={<CustomerFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit(id = 'cust-1') {
  return render(
    <MemoryRouter initialEntries={[`/customers/${id}/edit`]}>
      <Routes>
        <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderFromBooking(bookingId = 'booking-1') {
  return render(
    <MemoryRouter initialEntries={[`/customers/new?fromBookingId=${bookingId}`]}>
      <Routes>
        <Route path="/customers/new" element={<CustomerFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CustomerFormPage — create', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it('requires a name before submitting', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.click(screen.getByRole('button', { name: /create customer/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/name is required/i);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('creates a customer and navigates to it', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ id: 'cust-new', name: 'Jane Doe', duplicateWarnings: [] });
    renderNew();

    await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith('/api/customers', expect.objectContaining({ method: 'POST' }));
      expect(navigateMock).toHaveBeenCalledWith('/customers/cust-new');
    });
  });

  it('shows a duplicate warning without blocking navigation to the new record', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({
      id: 'cust-new', name: 'Jane Doe',
      duplicateWarnings: [{ type: 'email', customer: { id: 'cust-existing', name: 'Existing Jane', email: 'jane@example.com', phone: null, postcode: null } }],
    });
    renderNew();

    await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /create customer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/possible duplicate/i);
    expect(screen.getByText(/existing jane/i)).toBeInTheDocument();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/customers/cust-new'));
  });
});

describe('CustomerFormPage — create from a booking', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it('prefills name/email/phone/address/postcode from the booking and defaults source to website', async () => {
    authFetchMock.mockResolvedValue({
      id: 'booking-1', fullName: 'Jasmine Carter', email: 'jasmine@example.com', phone: '07123456789',
      address: '14 Elm Road', postcode: 'N15 5NJ',
    });
    renderFromBooking();

    expect(await screen.findByDisplayValue('Jasmine Carter')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jasmine@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('07123456789')).toBeInTheDocument();
    expect(screen.getByDisplayValue('14 Elm Road')).toBeInTheDocument();
    expect(screen.getByLabelText('Source')).toHaveValue('website');
  });

  it('still lets the admin edit the prefilled fields before submitting', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce({
      id: 'booking-1', fullName: 'Jasmine Carter', email: 'jasmine@example.com', phone: null, address: null, postcode: null,
    });
    renderFromBooking();
    await screen.findByDisplayValue('Jasmine Carter');

    const nameInput = screen.getByLabelText('Name *');
    await user.clear(nameInput);
    await user.type(nameInput, 'Jasmine C. Carter');

    authFetchMock.mockResolvedValueOnce({ id: 'cust-new', name: 'Jasmine C. Carter', duplicateWarnings: [] });
    await user.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => {
      const postCall = authFetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST');
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
      expect(body.name).toBe('Jasmine C. Carter');
    });
  });
});

describe('CustomerFormPage — edit', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    navigateMock.mockReset();
  });

  it('loads and prefills the existing customer', async () => {
    authFetchMock.mockResolvedValue({
      id: 'cust-1', name: 'Jane Doe', email: 'jane@example.com', phone: null, address: null, postcode: null,
      customerType: 'individual', source: 'other', preferredContactMethod: null, notes: null,
      createdByAdminId: 'admin-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    renderEdit();
    expect(await screen.findByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('submits a PATCH and navigates back to the detail page', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce({
      id: 'cust-1', name: 'Jane Doe', email: 'jane@example.com', phone: null, address: null, postcode: null,
      customerType: 'individual', source: 'other', preferredContactMethod: null, notes: null,
      createdByAdminId: 'admin-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    authFetchMock.mockResolvedValueOnce({ ok: true, duplicateWarnings: [] });
    renderEdit();

    await screen.findByDisplayValue('Jane Doe');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith('/api/customers/cust-1', expect.objectContaining({ method: 'PATCH' }));
      expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');
    });
  });
});
