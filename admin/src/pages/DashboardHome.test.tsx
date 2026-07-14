import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardHome from './DashboardHome';
import { ApiError } from '../lib/authFetch';
import type { DashboardSummary } from '../types/booking';

// vi.mock factories are hoisted above static imports, so this page's real
// authFetch.ts (and therefore the real supabase.ts, which throws without
// env vars) must never be loaded — vi.hoisted() + a self-contained factory
// (no vi.importActual) keeps the mock fully isolated from the real module.
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardHome />
    </MemoryRouter>,
  );
}

const emptySummary: DashboardSummary = {
  today: { count: 0, bookings: [] },
  upcoming: { count: 0, bookings: [] },
  recent: { count: 0, bookings: [] },
  depositsPaid: { count: 0 },
  outstandingBalances: { count: 0, dataAvailable: false },
  unscheduledCount: 0,
};

describe('DashboardHome', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows a loading state before data arrives', () => {
    authFetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderDashboard();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows a retryable error state on failure', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows honest empty states for every section when there is no data', async () => {
    authFetchMock.mockResolvedValue(emptySummary);
    renderDashboard();

    expect(await screen.findByText('No bookings today.')).toBeInTheDocument();
    expect(screen.getByText('No upcoming bookings scheduled.')).toBeInTheDocument();
    expect(screen.getByText('No bookings yet.')).toBeInTheDocument();
  });

  it('shows "No data yet" for outstanding balances rather than a misleading zero', async () => {
    authFetchMock.mockResolvedValue(emptySummary);
    renderDashboard();

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
  });

  it('shows a real outstanding-balance count once data has been recorded', async () => {
    authFetchMock.mockResolvedValue({
      ...emptySummary,
      outstandingBalances: { count: 3, dataAvailable: true },
    });
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Outstanding balances').previousSibling).toHaveTextContent('3'));
  });

  it('renders booking cards and counts when data is present', async () => {
    authFetchMock.mockResolvedValue({
      ...emptySummary,
      today: {
        count: 1,
        bookings: [
          {
            id: '1', bookingRef: 'N15NJ180726', fullName: 'Jasmine Carter', phone: '07123456789',
            postcode: 'N15 5NJ', service: 'end_of_tenancy', preferredDate: '2026-07-18', preferredTime: '10:00',
            serviceDate: '2026-07-18', status: 'confirmed', paymentStatus: 'paid', totalPrice: 249,
            createdAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      },
    });
    renderDashboard();

    expect(await screen.findByText('Jasmine Carter')).toBeInTheDocument();
    expect(screen.getByText('Today (1)')).toBeInTheDocument();
  });

  it('surfaces the unscheduled-bookings count as an honest note, not silently dropped', async () => {
    authFetchMock.mockResolvedValue({ ...emptySummary, unscheduledCount: 4 });
    renderDashboard();

    expect(await screen.findByText(/4 bookings without a/)).toBeInTheDocument();
  });
});
