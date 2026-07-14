import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BookingListPage from './BookingListPage';
import { ApiError } from '../lib/authFetch';

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

function renderList(initialEntries = ['/bookings']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BookingListPage />
    </MemoryRouter>,
  );
}

const sampleRow = {
  id: '1', bookingRef: 'N15NJ180726', fullName: 'Jasmine Carter', phone: '07123456789',
  postcode: 'N15 5NJ', service: 'end_of_tenancy', preferredDate: '2026-07-18', preferredTime: '10:00',
  serviceDate: '2026-07-18', status: 'confirmed', paymentStatus: 'paid', totalPrice: 249,
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('BookingListPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows an empty state when no bookings match', async () => {
    authFetchMock.mockResolvedValue({ results: [], page: 1, pageSize: 20, totalCount: 0, hasMore: false });
    renderList();

    expect(await screen.findByText('No bookings match these filters')).toBeInTheDocument();
  });

  it('shows a retryable error state on failure', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Could not load bookings.'));
    renderList();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders results (both the mobile card and desktop table are present in the DOM, gated by CSS)', async () => {
    authFetchMock.mockResolvedValue({ results: [sampleRow], page: 1, pageSize: 20, totalCount: 1, hasMore: false });
    renderList();

    const matches = await screen.findAllByText('Jasmine Carter');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('disables Previous on the first page and enables Next when more results exist', async () => {
    authFetchMock.mockResolvedValue({ results: [sampleRow], page: 1, pageSize: 20, totalCount: 50, hasMore: true });
    renderList();

    await screen.findAllByText('Jasmine Carter');
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('sends the selected status filter to the API', async () => {
    authFetchMock.mockResolvedValue({ results: [], page: 1, pageSize: 20, totalCount: 0, hasMore: false });
    const user = userEvent.setup();
    renderList();

    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /filters/i }));
    await user.selectOptions(screen.getByLabelText('Status'), 'confirmed');

    await waitFor(() => {
      const calls = authFetchMock.mock.calls;
      const lastCallUrl = calls[calls.length - 1]?.[0] as string;
      expect(lastCallUrl).toContain('status=confirmed');
    });
  });
});
