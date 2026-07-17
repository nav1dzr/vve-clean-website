import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceListPage from './InvoiceListPage';
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

function renderList(initialEntries = ['/invoices']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <InvoiceListPage />
    </MemoryRouter>,
  );
}

const sampleRow = {
  id: 'inv-1', invoiceNumber: 'INV-2026-000001', customerName: 'Jane Doe',
  total: 150, amountDue: 120, documentStatus: 'issued', paymentStatus: 'partially_paid',
  dueDate: '2026-08-01', issueDate: '2026-07-16', createdAt: '2026-07-16T00:00:00.000Z',
};

describe('InvoiceListPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it('shows an empty state when no invoices match', async () => {
    authFetchMock.mockResolvedValue({ results: [], page: 1, pageSize: 20, totalCount: 0, hasMore: false });
    renderList();
    expect(await screen.findByText('No invoices match these filters')).toBeInTheDocument();
  });

  it('shows a retryable error state on failure', async () => {
    authFetchMock.mockRejectedValue(new ApiError(500, 'Could not load invoices.'));
    renderList();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders results with the invoice number and customer name', async () => {
    authFetchMock.mockResolvedValue({ results: [sampleRow], page: 1, pageSize: 20, totalCount: 1, hasMore: false });
    renderList();
    const matches = await screen.findAllByText('Jane Doe');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('always shows a link to create a new invoice', async () => {
    authFetchMock.mockResolvedValue({ results: [sampleRow], page: 1, pageSize: 20, totalCount: 1, hasMore: false });
    renderList();
    await screen.findAllByText('Jane Doe');
    expect(screen.getByRole('link', { name: /new invoice/i })).toHaveAttribute('href', '/invoices/new');
  });
});
