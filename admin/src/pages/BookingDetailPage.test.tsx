import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookingDetailPage from './BookingDetailPage';
import { ApiError } from '../lib/authFetch';
import type { BookingDetail } from '../types/booking';

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

describe('BookingDetailPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows a not-found state for a 404, with a way back to the list', async () => {
    authFetchMock.mockRejectedValue(new ApiError(404, 'Booking not found'));
    renderDetail();

    expect(await screen.findByText('Booking not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to bookings/i })).toBeInTheDocument();
  });

  it('shows a retryable error state for a non-404 failure', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders working call, WhatsApp, and email action links with normalised phone', async () => {
    authFetchMock.mockResolvedValue(fullBooking);
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
    authFetchMock.mockResolvedValue({ ...fullBooking, phone: null, email: null });
    renderDetail();

    expect(await screen.findByText('Call unavailable')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp unavailable')).toBeInTheDocument();
    expect(screen.getByText('Email unavailable')).toBeInTheDocument();
  });

  it('shows honest labels for missing historical data instead of £undefined/NaN/blank', async () => {
    authFetchMock.mockResolvedValue({
      ...fullBooking,
      totalPrice: null,
      balance: null,
      quoteConfig: null,
      serviceDate: null,
      preferredDate: null,
      preferredTime: null,
    });
    renderDetail();

    expect(await screen.findByText('Itemised quote unavailable')).toBeInTheDocument();
    expect(screen.getByText('Balance unavailable')).toBeInTheDocument();
    // "Not recorded" appears for both the missing date and the missing total.
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    // Word-boundary match — a plain /NaN/i would also match "te-nan-cy".
    expect(screen.queryByText(/\bNaN\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('never renders the confirmation token anywhere on the page', async () => {
    authFetchMock.mockResolvedValue(fullBooking);
    const { container } = renderDetail();
    await screen.findByText('N15NJ180726');
    expect(container.innerHTML).not.toMatch(/confirmation_?token/i);
  });
});
