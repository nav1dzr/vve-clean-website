import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerListPage from './CustomerListPage';
import { ApiError } from '../lib/authFetch';

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

function renderList(initialEntries = ['/customers']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CustomerListPage />
    </MemoryRouter>,
  );
}

const sampleRow = {
  id: 'cust-1', name: 'Acme Lettings', email: 'ops@acme.example.com', phone: null, postcode: 'E1 6AN',
  customerType: 'letting_agent', source: 'referral', createdAt: '2026-01-01T00:00:00.000Z',
};

describe('CustomerListPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows an empty state when no customers match', async () => {
    authFetchMock.mockResolvedValue({ results: [], page: 1, pageSize: 20, totalCount: 0, hasMore: false });
    renderList();
    expect(await screen.findByText('No customers match these filters')).toBeInTheDocument();
  });

  it('shows a retryable error state on failure', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Could not load customers.'));
    renderList();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders results with the customer name and type', async () => {
    authFetchMock.mockResolvedValue({ results: [sampleRow], page: 1, pageSize: 20, totalCount: 1, hasMore: false });
    renderList();
    const link = await screen.findByRole('link', { name: /acme lettings/i });
    expect(link).toHaveTextContent('Letting agent');
  });

  it('always shows a link to create a new customer', async () => {
    authFetchMock.mockResolvedValue({ results: [sampleRow], page: 1, pageSize: 20, totalCount: 1, hasMore: false });
    renderList();
    await screen.findByText('Acme Lettings');
    expect(screen.getByRole('link', { name: /new customer/i })).toHaveAttribute('href', '/customers/new');
  });
});
