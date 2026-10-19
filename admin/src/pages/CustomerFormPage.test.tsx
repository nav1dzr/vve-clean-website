import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import CustomerFormPage from './CustomerFormPage';
import { ApiError } from '../lib/authFetch';

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

  it('stores Checkatrade using the supported source and preserves the owner notes', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ id: 'new-customer', duplicateWarnings: [] });
    renderNew();
    await user.type(screen.getByLabelText('Name *'), 'Synthetic customer');
    await user.selectOptions(screen.getByLabelText('Source'), 'checkatrade');
    await user.type(screen.getByLabelText('Notes'), 'Keys held by concierge.');
    await user.click(screen.getByRole('button', { name: 'Create customer' }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled());
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body)).toMatchObject({ source: 'other', notes: 'Customer source: Checkatrade.\nKeys held by concierge.' });
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

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/customers/cust-new', {
      state: { duplicateWarnings: [expect.objectContaining({ type: 'email', customer: expect.objectContaining({ id: 'cust-existing', name: 'Existing Jane' }) })] },
    }));
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

  it('submits the loaded version, preserves a stale edit, and reloads only after explicit discard', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce({ id: 'cust-1', name: 'Test customer', customerType: 'individual', source: 'other', notes: 'Original', updatedAt: '2026-10-18T12:00:00.000Z' });
    renderEdit();
    await screen.findByDisplayValue('Test customer');
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'My unsaved edit');
    authFetchMock.mockRejectedValueOnce(new ApiError(409, 'This customer changed since you opened it. Copy your edits, then reload and review the latest details before saving.'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('customer changed');
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body).expectedUpdatedAt).toBe('2026-10-18T12:00:00.000Z');
    expect(screen.getByLabelText('Notes')).toHaveValue('My unsaved edit');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(navigateMock).not.toHaveBeenCalled();
    authFetchMock.mockResolvedValueOnce({ id: 'cust-1', name: 'Test customer', customerType: 'individual', source: 'other', notes: 'Latest saved by another editor', updatedAt: '2026-10-18T12:05:00.000Z' });
    await user.click(screen.getByRole('button', { name: 'Discard edits and reload latest' }));
    expect(await screen.findByDisplayValue('Latest saved by another editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('uses the returned version after a successful save stays open for a duplicate warning', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce({ id: 'cust-1', name: 'Test customer', customerType: 'individual', source: 'other', updatedAt: '2026-10-18T12:00:00.000Z' });
    renderEdit();
    await screen.findByDisplayValue('Test customer');
    authFetchMock.mockResolvedValueOnce({ ok: true, updatedAt: '2026-10-18T12:05:00.000Z', duplicateWarnings: [{ type: 'email', customer: { id: 'other', name: 'Other customer' } }] });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Possible duplicate/);
    await user.type(screen.getByLabelText('Notes'), 'Reviewed duplicate; separate person.');
    authFetchMock.mockResolvedValueOnce({ ok: true, updatedAt: '2026-10-18T12:06:00.000Z', duplicateWarnings: [] });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(JSON.parse(authFetchMock.mock.calls[2][1].body).expectedUpdatedAt).toBe('2026-10-18T12:05:00.000Z');
    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');
  });

  it('recognises a saved Checkatrade source and keeps existing notes when saving again', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValueOnce({ id: 'cust-1', name: 'Synthetic customer', customerType: 'individual', source: 'other', notes: 'Customer source: Checkatrade.\nKeep side gate shut.', updatedAt: '2026-10-18T12:00:00.000Z' });
    authFetchMock.mockResolvedValueOnce({ ok: true, duplicateWarnings: [] });
    renderEdit();
    await screen.findByDisplayValue('Synthetic customer');
    expect(screen.getByLabelText('Source')).toHaveValue('checkatrade');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body)).toMatchObject({ source: 'other', notes: 'Customer source: Checkatrade.\nKeep side gate shut.' });
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

  it.each(['customer', 'booking'])('retries a failed %s load with a fresh request', async (mode) => {
    const user = userEvent.setup();
    authFetchMock.mockRejectedValueOnce(new ApiError(503, 'Temporary load failure'));
    if (mode === 'customer') renderEdit(); else renderFromBooking();
    await screen.findByText('Temporary load failure');
    authFetchMock.mockResolvedValueOnce({ name: 'Recovered customer', fullName: 'Recovered customer', customerType: 'individual', source: 'other' });
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByDisplayValue('Recovered customer')).toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a late customer response after navigating to another customer', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: unknown) => void;
    authFetchMock.mockImplementation((url: string) => url.endsWith('/cust-1')
      ? new Promise((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ name: 'Current customer', customerType: 'individual', source: 'other' }));
    render(<MemoryRouter initialEntries={['/customers/cust-1/edit']}><Link to="/customers/cust-2/edit">Next customer</Link><Routes><Route path="/customers/:id/edit" element={<CustomerFormPage />} /></Routes></MemoryRouter>);
    await user.click(screen.getByRole('link', { name: 'Next customer' }));
    await screen.findByDisplayValue('Current customer');
    await act(async () => { resolveFirst({ name: 'Old customer', customerType: 'individual', source: 'other' }); });
    expect(screen.queryByDisplayValue('Old customer')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Current customer')).toBeInTheDocument();
  });

  it('does not carry old customer fields into a new blank record', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ name: 'Existing customer', customerType: 'individual', source: 'other' });
    render(<MemoryRouter initialEntries={['/customers/cust-1/edit']}><Link to="/customers/new">Blank customer</Link><Routes><Route path="/customers/:id/edit" element={<CustomerFormPage />} /><Route path="/customers/new" element={<CustomerFormPage />} /></Routes></MemoryRouter>);
    await screen.findByDisplayValue('Existing customer');
    await user.click(screen.getByRole('link', { name: 'Blank customer' }));
    expect(screen.getByLabelText('Name *')).toHaveValue('');
  });
});
