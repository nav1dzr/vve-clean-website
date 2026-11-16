import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NeedsAttention from './NeedsAttention';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args) }));

const counts = (overrides: Record<string, number | null> = {}) => ({
  today: '2026-11-16', recentJobsFrom: '2026-10-17', yesterday: '2026-11-15', emailQueueEnabled: true,
  counts: {
    newEnquiries: 0, requestsToReview: 0, depositsAwaited: 0, jobsToComplete: 0, invoicesNotEmailed: 0,
    invoicesOverdue: 0, invoicesUnpaid: 0, emailsNeedingAttention: 0, emailsScheduled: 0, ...overrides,
  },
});
const show = () => render(<MemoryRouter><NeedsAttention /></MemoryRouter>);

describe('NeedsAttention', () => {
  beforeEach(() => { authFetchMock.mockReset(); });

  it('lists only what is waiting, each as a link to where it is handled', async () => {
    authFetchMock.mockResolvedValue(counts({ newEnquiries: 2, invoicesOverdue: 1, invoicesNotEmailed: 3, invoicesUnpaid: 4, emailsScheduled: 1 }));
    show();
    expect(await screen.findByRole('link', { name: /2 new enquiries to answer/ })).toHaveAttribute('href', '/enquiries');
    expect(screen.getByRole('link', { name: /1 invoice is overdue/ })).toHaveAttribute('href', '/invoices?overdue=1');
    expect(screen.getByRole('link', { name: /3 invoices issued but not emailed/ })).toHaveAttribute('href', '/invoices?delivery=unsent');
    expect(screen.getByRole('link', { name: '4 invoices awaiting payment' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 email scheduled' })).toBeInTheDocument();
    expect(screen.queryByText(/deposit/)).not.toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledWith('/api/dashboard-summary?view=attention');
  });

  it('says so plainly when nothing is waiting', async () => {
    authFetchMock.mockResolvedValue(counts());
    show();
    expect(await screen.findByText('Nothing is waiting for you right now.')).toBeInTheDocument();
  });

  it('never presents a count that could not be read as zero', async () => {
    authFetchMock.mockResolvedValue(counts({ invoicesOverdue: null, newEnquiries: 1 }));
    show();
    expect(await screen.findByText(/One check could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing is waiting for you right now.')).not.toBeInTheDocument();
  });

  it('offers a reload when the list cannot be loaded, without hiding the rest of Home', async () => {
    authFetchMock.mockRejectedValue(new Error('offline'));
    show();
    expect(await screen.findByRole('button', { name: 'Reload to-do list' })).toBeInTheDocument();
  });
});
