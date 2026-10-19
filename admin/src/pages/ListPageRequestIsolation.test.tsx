import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerListPage from './CustomerListPage';
import InvoiceListPage from './InvoiceListPage';
import ReceiptListPage from './ReceiptListPage';
import { ApiError } from '../lib/authFetch';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => {
  class MockApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  }
  return { authFetch: (...args: unknown[]) => authFetchMock(...args), ApiError: MockApiError };
});

function results(name: string) {
  return {
    results: [{
      id: name, name, customerName: name, email: null, phone: null, postcode: 'E1 1AA',
      customerType: 'individual', source: 'direct', createdAt: '2026-10-01T00:00:00Z',
      invoiceNumber: `INV-${name}`, receiptNumber: `REC-${name}`, total: 85, amountDue: 85,
      documentStatus: 'issued', paymentStatus: 'unpaid', totalPaid: 85, dueDate: null,
      paymentDate: '2026-10-01', issueDate: '2026-10-01', serviceDescription: 'Synthetic audit',
    }],
    page: 1, pageSize: 20, totalCount: 1, hasMore: false,
  };
}

function deferred() {
  let resolve!: (value: ReturnType<typeof results>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<ReturnType<typeof results>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const variants = [
  {
    name: 'customers', Page: CustomerListPage, changedQuery: 'customerType=landlord',
    change: () => fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'landlord' } }),
  },
  {
    name: 'invoices', Page: InvoiceListPage, changedQuery: 'documentStatus=issued',
    change: () => fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'issued' } }),
  },
  {
    name: 'receipts', Page: ReceiptListPage, changedQuery: 'q=Current',
    change: () => {
      fireEvent.change(screen.getByPlaceholderText('Search receipt number or customer…'), { target: { value: 'Current' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    },
  },
];

describe('List-page request isolation', () => {
  beforeEach(() => authFetchMock.mockReset());

  for (const { name, Page, changedQuery, change } of variants) {
    it(`${name}: an old response cannot replace the newer filter's rows or links`, async () => {
      const previous = deferred();
      authFetchMock.mockReturnValueOnce(previous.promise).mockResolvedValue(results('Current result'));
      render(<MemoryRouter initialEntries={[`/${name}`]}><Page /></MemoryRouter>);
      change();
      expect((await screen.findAllByText('Current result')).length).toBeGreaterThan(0);
      expect(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1]?.[0]).toContain(changedQuery);
      await act(async () => { previous.resolve(results('Old result')); });
      expect(screen.queryAllByText('Old result')).toHaveLength(0);
      expect(screen.getAllByText('Current result').length).toBeGreaterThan(0);
    });

    it(`${name}: an old failure cannot replace a newer successful list`, async () => {
      const previous = deferred();
      authFetchMock.mockReturnValueOnce(previous.promise).mockResolvedValue(results('Current result'));
      render(<MemoryRouter initialEntries={[`/${name}`]}><Page /></MemoryRouter>);
      change();
      await screen.findAllByText('Current result');
      await act(async () => { previous.reject(new ApiError(503, 'Old list failed')); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getAllByText('Current result').length).toBeGreaterThan(0);
    });
  }

  it('receipts: Back and Forward keep the search field aligned with the fetched URL query', async () => {
    function HistoryButtons() {
      const navigate = useNavigate();
      return <><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button></>;
    }
    authFetchMock.mockResolvedValue(results('Current result'));
    render(<MemoryRouter initialEntries={['/receipts?q=Earlier']}><HistoryButtons /><ReceiptListPage /></MemoryRouter>);
    await screen.findAllByText('Current result');
    const input = screen.getByPlaceholderText('Search receipt number or customer…');
    fireEvent.change(input, { target: { value: 'Latest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1]?.[0]).toContain('q=Latest'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1]?.[0]).toContain('q=Earlier'));
    expect(input).toHaveValue('Earlier');
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    await waitFor(() => expect(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1]?.[0]).toContain('q=Latest'));
    expect(input).toHaveValue('Latest');
  });
});
