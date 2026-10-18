import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import SearchPage from './SearchPage';
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

function renderSearch(initialEntries = ['/search']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SearchPage />
    </MemoryRouter>,
  );
}

function HistoryControls() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button></>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('SearchPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows an idle prompt and makes no request for an empty query', () => {
    renderSearch();
    expect(screen.getByText('Search for a customer')).toBeInTheDocument();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('runs a search from the URL query param on load', async () => {
    authFetchMock.mockResolvedValue({ results: [] });
    renderSearch(['/search?q=Jasmine']);

    expect(await screen.findByText(/no results for "Jasmine"/i)).toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledWith('/api/search', { method: 'POST', body: JSON.stringify({ q: 'Jasmine' }) });
  });

  it('shows a no-results state distinct from the idle state', async () => {
    authFetchMock.mockResolvedValue({ results: [] });
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByLabelText(/search name, phone/i), 'zzznomatch');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/no matches/i)).toBeInTheDocument();
  });

  it('shows a retryable error state on failure', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Search failed'));
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByLabelText(/search name, phone/i), 'Jasmine');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Search failed');
  });

  it('renders result cards for a successful search', async () => {
    authFetchMock.mockResolvedValue({
      results: [
        {
          id: '1', bookingRef: 'N15NJ180726', fullName: 'Jasmine Carter', phone: '07123456789',
          postcode: 'N15 5NJ', service: 'end_of_tenancy', preferredDate: '2026-07-18', preferredTime: '10:00',
          serviceDate: '2026-07-18', status: 'confirmed', paymentStatus: 'paid', totalPrice: 249,
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByLabelText(/search name, phone/i), 'Jasmine');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Jasmine Carter')).toBeInTheDocument();
    expect(screen.getByText('N15NJ180726')).toBeInTheDocument();
  });

  it('keeps the latest search when an earlier response arrives last', async () => {
    const first = deferred<{ results: [] }>();
    authFetchMock.mockReturnValueOnce(first.promise).mockResolvedValue({ results: [] });
    const user = userEvent.setup();
    renderSearch(['/search?q=Earlier']);
    const input = screen.getByRole('searchbox');
    await user.clear(input);
    await user.type(input, 'Latest{Enter}');
    expect(await screen.findByText(/no results for "Latest"/i)).toBeInTheDocument();
    await act(async () => { first.resolve({ results: [] }); });
    expect(screen.getByText(/no results for "Latest"/i)).toBeInTheDocument();
    expect(screen.queryByText(/no results for "Earlier"/i)).not.toBeInTheDocument();
  });

  it('ignores an earlier failure after a newer search succeeds', async () => {
    const first = deferred<{ results: [] }>();
    authFetchMock.mockReturnValueOnce(first.promise).mockResolvedValue({ results: [] });
    const user = userEvent.setup();
    renderSearch(['/search?q=Earlier']);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'Latest{Enter}');
    expect(await screen.findByText(/no results for "Latest"/i)).toBeInTheDocument();
    await act(async () => { first.reject(new ApiError(500, 'Old search failed')); });
    expect(screen.getByText(/no results for "Latest"/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps an empty submitted query idle after an earlier search resolves', async () => {
    const first = deferred<{ results: [] }>();
    authFetchMock.mockReturnValue(first.promise);
    const user = userEvent.setup();
    renderSearch(['/search?q=Earlier']);
    await user.clear(screen.getByRole('searchbox'));
    await user.keyboard('{Enter}');
    await act(async () => { first.resolve({ results: [] }); });
    expect(screen.getByText('Search for a customer')).toBeInTheDocument();
    expect(screen.queryByText(/no results for "Earlier"/i)).not.toBeInTheDocument();
  });

  it('keeps the input and results in sync with browser Back and Forward', async () => {
    authFetchMock.mockResolvedValue({ results: [] });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/search?q=First']}><HistoryControls /><SearchPage /></MemoryRouter>);
    expect(await screen.findByText(/no results for "First"/i)).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'Second{Enter}');
    expect(await screen.findByText(/no results for "Second"/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText(/no results for "First"/i)).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('First');
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(await screen.findByText(/no results for "Second"/i)).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('Second');
  });
});
