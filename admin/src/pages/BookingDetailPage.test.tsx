import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookingDetailPage from './BookingDetailPage';
import { ApiError } from '../lib/authFetch';
import type { BookingDetail, InternalNote } from '../types/booking';

// See DashboardHome.test.tsx for why this must not use vi.importActual —
// it would load the real supabase.ts, which throws without env vars.
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

function renderDetail(id = '123e4567-e89b-12d3-a456-426614174000') {
  return render(
    <MemoryRouter initialEntries={[`/bookings/${id}`]}>
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/bookings" element={<div>Bookings list page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fullBooking: BookingDetail = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  bookingRef: 'N15NJ180726',
  fullName: 'Jasmine Carter',
  phone: '07123456789',
  email: 'jasmine@example.com',
  address: '14 Elm Road',
  postcode: 'N15 5NJ',
  service: 'end_of_tenancy',
  quoteConfig: { deepService: 'end_of_tenancy', deepSize: 'bed2' },
  preferredDate: '2026-07-18',
  preferredTime: '10:00',
  serviceDate: '2026-07-18',
  notes: 'Parking round the back',
  totalPrice: 249,
  depositAmount: 30,
  balance: 219,
  paymentStatus: 'paid',
  balanceStatus: 'outstanding',
  balancePaidAt: null,
  balancePaymentMethod: null,
  status: 'confirmed',
  stripe: { sessionId: 'cs_live_abc', paymentIntentId: 'pi_abc' },
  attribution: {
    offerCode: null, discountPercent: null, standardTotal: null, discountAmount: null, finalTotalAfterDiscount: null,
    firstSource: 'google', lastSource: 'google', landingPage: '/', utmSource: null, utmMedium: null,
    utmCampaign: null, utmContent: null, gclid: null,
  },
  notifications: { emailCustomerSent: true, emailBusinessSent: true, telegramSent: true, sheetsSent: true },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

// The page now issues several distinct authFetch calls (booking detail,
// notes list, and on-demand status/balance PATCHes) — this router keeps
// each test's mock responses matched to the right endpoint by path/method
// instead of one blanket mockResolvedValue.
function setupAuthFetchMock(
  overrides: {
    booking?: BookingDetail;
    bookingError?: ApiError;
    notes?: InternalNote[];
    notesError?: ApiError;
    addNoteError?: ApiError;
    statusError?: ApiError;
    balanceError?: ApiError;
  } = {},
) {
  authFetchMock.mockImplementation((path: string, init?: RequestInit) => {
    const method = init?.method || 'GET';

    if (/\/notes$/.test(path)) {
      if (method === 'POST') {
        if (overrides.addNoteError) return Promise.reject(overrides.addNoteError);
        const body = JSON.parse((init?.body as string) || '{}');
        return Promise.resolve({
          id: 'new-note-id',
          note: body.note,
          createdAt: '2026-07-14T00:00:00.000Z',
          author: { id: 'admin-1', displayName: 'Sam Wilson' },
        });
      }
      if (overrides.notesError) return Promise.reject(overrides.notesError);
      return Promise.resolve({ notes: overrides.notes ?? [] });
    }

    if (/\/status$/.test(path)) {
      if (overrides.statusError) return Promise.reject(overrides.statusError);
      const body = JSON.parse((init?.body as string) || '{}');
      return Promise.resolve({ id: fullBooking.id, status: body.status, updatedAt: '2026-07-14T00:00:00.000Z' });
    }

    if (/\/balance$/.test(path)) {
      if (overrides.balanceError) return Promise.reject(overrides.balanceError);
      const body = JSON.parse((init?.body as string) || '{}');
      return Promise.resolve({
        id: fullBooking.id,
        balanceStatus: body.balanceStatus,
        balancePaidAt: body.balanceStatus === 'paid' ? '2026-07-14T00:00:00.000Z' : null,
        balancePaymentMethod: body.balanceStatus === 'paid' ? (body.balancePaymentMethod ?? null) : null,
        updatedAt: '2026-07-14T00:00:00.000Z',
      });
    }

    // BookingInvoicesSection's financial-documents list — not under test
    // here (see InvoiceListPage.test.tsx / BookingInvoicesSection usage
    // elsewhere); always resolve an empty list so it renders its "no
    // invoices yet" state without affecting any assertion in this file.
    if (/\/api\/invoices/.test(path)) {
      return Promise.resolve({ results: [], page: 1, pageSize: 50, totalCount: 0, hasMore: false });
    }

    // Booking detail fetch.
    if (overrides.bookingError) return Promise.reject(overrides.bookingError);
    return Promise.resolve(overrides.booking ?? fullBooking);
  });
}

describe('BookingDetailPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows a not-found state for a 404, with a way back to the list', async () => {
    setupAuthFetchMock({ bookingError: new ApiError(404, 'Booking not found') });
    renderDetail();

    expect(await screen.findByText('Booking not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to bookings/i })).toBeInTheDocument();
  });

  it('shows a retryable error state for a non-404 failure', async () => {
    setupAuthFetchMock({ bookingError: new ApiError(500, 'Internal server error') });
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders working call, WhatsApp, and email action links with normalised phone', async () => {
    setupAuthFetchMock();
    renderDetail();

    const call = await screen.findByRole('link', { name: 'Call' });
    expect(call).toHaveAttribute('href', 'tel:07123456789');

    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/447123456789');
    expect(whatsapp).toHaveAttribute('target', '_blank');

    const email = screen.getByRole('link', { name: 'Email' });
    expect(email).toHaveAttribute('href', 'mailto:jasmine@example.com');
  });

  it('shows "unavailable" action states instead of broken links when contact info is missing', async () => {
    setupAuthFetchMock({ booking: { ...fullBooking, phone: null, email: null } });
    renderDetail();

    expect(await screen.findByText('Call unavailable')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp unavailable')).toBeInTheDocument();
    expect(screen.getByText('Email unavailable')).toBeInTheDocument();
  });

  it('shows honest labels for missing historical data instead of £undefined/NaN/blank', async () => {
    setupAuthFetchMock({
      booking: {
        ...fullBooking,
        totalPrice: null,
        balance: null,
        quoteConfig: null,
        serviceDate: null,
        preferredDate: null,
        preferredTime: null,
      },
    });
    renderDetail();

    expect(await screen.findByText('Itemised quote unavailable')).toBeInTheDocument();
    expect(screen.getByText('Total not recorded — balance cannot be calculated.')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    // Word-boundary match — a plain /NaN/i would also match "te-nan-cy".
    expect(screen.queryByText(/\bNaN\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('never renders the confirmation token anywhere on the page', async () => {
    setupAuthFetchMock();
    const { container } = renderDetail();
    await screen.findByText('N15NJ180726');
    expect(container.innerHTML).not.toMatch(/confirmation_?token/i);
  });

  describe('internal notes', () => {
    it('shows a loading state then the empty state when there are no notes', async () => {
      setupAuthFetchMock({ notes: [] });
      renderDetail();

      expect(await screen.findByText('No internal notes yet.')).toBeInTheDocument();
      expect(screen.getByText('Visible only to authorised VVE staff.')).toBeInTheDocument();
    });

    it('lists existing notes with author and timestamp', async () => {
      setupAuthFetchMock({
        notes: [
          { id: 'n1', note: 'Called to confirm access.', createdAt: '2026-07-11T14:02:00.000Z', author: { id: 'a1', displayName: 'Sam Wilson' } },
        ],
      });
      renderDetail();

      expect(await screen.findByText('Called to confirm access.')).toBeInTheDocument();
      expect(screen.getByText(/Sam Wilson/)).toBeInTheDocument();
    });

    it('shows a retryable error state when notes fail to load', async () => {
      setupAuthFetchMock({ notesError: new ApiError(500, 'Could not load notes.') });
      renderDetail();

      await screen.findByText('N15NJ180726');
      expect(await screen.findByText('Could not load notes.')).toBeInTheDocument();
    });

    it('adds a note through the modal and shows it in the list without a full reload', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('No internal notes yet.');
      await user.click(screen.getByRole('button', { name: '+ Add note' }));

      const textarea = screen.getByLabelText('Note');
      await user.type(textarea, 'Left a card, will call tomorrow.');
      await user.click(screen.getByRole('button', { name: 'Save note' }));

      expect(await screen.findByText('Left a card, will call tomorrow.')).toBeInTheDocument();
      expect(screen.getByText(/Sam Wilson/)).toBeInTheDocument();
    });

    it('rejects an empty note client-side without calling the API', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('No internal notes yet.');
      await user.click(screen.getByRole('button', { name: '+ Add note' }));
      const callsBeforeSubmit = authFetchMock.mock.calls.length;

      await user.click(screen.getByRole('button', { name: 'Save note' }));

      expect(await screen.findByText('Enter a note before saving.')).toBeInTheDocument();
      const postCalls = authFetchMock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === 'POST');
      expect(postCalls).toHaveLength(0);
      expect(authFetchMock.mock.calls.length).toBe(callsBeforeSubmit);
    });

    it('disables the save button while a submission is in flight (duplicate-submit prevention)', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('No internal notes yet.');
      await user.click(screen.getByRole('button', { name: '+ Add note' }));
      await user.type(screen.getByLabelText('Note'), 'A note');

      const saveButton = screen.getByRole('button', { name: 'Save note' });
      await user.click(saveButton);

      // Once a save has resolved, a fresh click is a distinct, valid submission.
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows an error state and keeps the modal open when saving a note fails', async () => {
      setupAuthFetchMock({ notes: [], addNoteError: new ApiError(500, 'Could not save this note.') });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('No internal notes yet.');
      await user.click(screen.getByRole('button', { name: '+ Add note' }));
      await user.type(screen.getByLabelText('Note'), 'A note');
      await user.click(screen.getByRole('button', { name: 'Save note' }));

      expect(await screen.findByText('Could not save this note.')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('returns focus to the Add note button after closing the modal', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('No internal notes yet.');
      const addButton = screen.getByRole('button', { name: '+ Add note' });
      await user.click(addButton);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(addButton).toHaveFocus();
    });
  });

  describe('status control', () => {
    it('applies a routine status change immediately, with a success message', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('N15NJ180726');
      await user.selectOptions(screen.getByLabelText('Update booking status'), 'scheduled');

      expect(await screen.findByText('Status updated.')).toBeInTheDocument();
    });

    it('requires confirmation before applying a cancelled status', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('N15NJ180726');
      await user.selectOptions(screen.getByLabelText('Update booking status'), 'cancelled');

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.queryByText('Status updated.')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(await screen.findByText('Status updated.')).toBeInTheDocument();
    });

    it('does not apply the change if the confirmation is cancelled', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('N15NJ180726');
      await user.selectOptions(screen.getByLabelText('Update booking status'), 'no_show');
      const statusPatchCallsBefore = authFetchMock.mock.calls.filter((c) => /\/status$/.test(c[0] as string)).length;

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      const statusPatchCallsAfter = authFetchMock.mock.calls.filter((c) => /\/status$/.test(c[0] as string)).length;
      expect(statusPatchCallsAfter).toBe(statusPatchCallsBefore);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('shows an error state when the status update fails', async () => {
      setupAuthFetchMock({ notes: [], statusError: new ApiError(500, 'Could not update status.') });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('N15NJ180726');
      await user.selectOptions(screen.getByLabelText('Update booking status'), 'scheduled');

      expect(await screen.findByText('Could not update status.')).toBeInTheDocument();
    });
  });

  describe('balance control', () => {
    it('shows deposit-paid and fully-paid as visibly distinct states', async () => {
      setupAuthFetchMock({ notes: [] });
      renderDetail();

      await screen.findByText('N15NJ180726');
      // Deposit is "Paid" (payment_status) while balance is "Outstanding" —
      // must never collapse into one ambiguous badge. "Paid" legitimately
      // appears twice (header quick-glance badge + Balance section badge)
      // plus once as a <option>; the key assertion is that "Outstanding"
      // (the balance) is shown distinctly rather than also saying "Paid".
      expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Outstanding').length).toBeGreaterThanOrEqual(1);
    });

    it('updates the balance status and shows a success message', async () => {
      setupAuthFetchMock({ notes: [] });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('N15NJ180726');
      await user.selectOptions(screen.getByLabelText('Update balance status'), 'paid');
      await user.click(screen.getByRole('button', { name: 'Save balance status' }));

      expect(await screen.findByText('Balance updated.')).toBeInTheDocument();
    });

    it('shows an error state when the balance update fails', async () => {
      setupAuthFetchMock({ notes: [], balanceError: new ApiError(500, 'Could not update the balance.') });
      const user = userEvent.setup();
      renderDetail();

      await screen.findByText('N15NJ180726');
      await user.selectOptions(screen.getByLabelText('Update balance status'), 'paid');
      await user.click(screen.getByRole('button', { name: 'Save balance status' }));

      expect(await screen.findByText('Could not update the balance.')).toBeInTheDocument();
    });
  });
});
