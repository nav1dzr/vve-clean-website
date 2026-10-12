import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import BookingManagementPage from './BookingManagementPage';

const offered = {
  reference: 'VVE-TEST-STATUS-20261012', firstName: 'Example', revision: 3, offerVersion: 1,
  state: 'offered', agreement: {
    service: 'Carpet cleaning', items: 'Bedroom', scope: '', exclusions: '', address: 'Example only',
    postcode: 'E1 1AA', date: '2099-10-10', time: '09:00–11:00', totalPence: 8500,
    preparation: 'Clear the floor', paymentPlan: 'deposit_after_agreement',
  }, previousAgreement: null, holdUntil: '2099-10-10T09:00:00Z', paidPence: 0,
  refundedPence: 0, balancePence: 8500, customerRequest: null,
  canPayDeposit: true, canPayBalance: false, canChange: true, canAccept: false,
};
const result = (booking = offered) => ({ ok: true, json: async () => ({ booking }) }) as Response;
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/manage-booking#token=synthetic-private-status');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(result()));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('read-only payment status recovery', () => {
  it('shows confirmation only after a read-only status check returns the verified state', async () => {
    render(<BookingManagementPage />);
    await screen.findByRole('button', { name: 'Check payment status' });
    vi.mocked(fetch).mockResolvedValueOnce(result({ ...offered, state: 'confirmed', paidPence: 3000, balancePence: 5500, canPayDeposit: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Check payment status' }));
    expect(await screen.findByRole('heading', { name: 'Your clean is booked' })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Pay £30 deposit by card' })).not.toBeInTheDocument();
  });

  it('keeps an unverified payment pending and does not trust a browser paid parameter', async () => {
    window.history.replaceState(null, '', '/manage-booking?paid=true#token=synthetic-private-status');
    render(<BookingManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check payment status' }));
    expect(await screen.findByText(/We haven't recorded your deposit yet/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your clean is booked' })).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });

  it('retains the existing details and an honest recovery message if checking fails', async () => {
    render(<BookingManagementPage />);
    await screen.findByRole('button', { name: 'Check payment status' });
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Check payment status' }));
    expect(await screen.findByText(/We couldn't check the latest status/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Please check your booking details' })).toBeInTheDocument();
  });

  it('stops automatic checks after six attempts and never starts checkout', async () => {
    vi.useFakeTimers();
    render(<BookingManagementPage />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(125000); });
    expect(fetch).toHaveBeenCalledTimes(7); // initial read + six bounded checks
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });

  it('does not poll when the document is hidden and resumes read-only when visible', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<BookingManagementPage />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(fetch).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the server confirms the booking', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(result()).mockResolvedValue(result({ ...offered, state: 'confirmed', paidPence: 3000, balancePence: 5500, canPayDeposit: false }));
    render(<BookingManagementPage />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'Your clean is booked' })).toBeInTheDocument();
  });

  it('explains the existing card checkout deadline rather than offering a rejected checkout', async () => {
    vi.mocked(fetch).mockResolvedValue(result({ ...offered, holdUntil: new Date(Date.now() + 30 * 60000).toISOString() }));
    render(<BookingManagementPage />);
    expect(await screen.findByText(/deadline is too close to open a new card checkout/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay £30 deposit by card' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not open checkout from an email Pay link too near the existing deadline', async () => {
    window.history.replaceState(null, '', '/manage-booking#token=synthetic-private-status&pay=deposit');
    vi.mocked(fetch).mockResolvedValue(result({ ...offered, holdUntil: new Date(Date.now() + 30 * 60000).toISOString() }));
    render(<BookingManagementPage />);
    await screen.findByRole('button', { name: 'Check payment status' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('GET');
  });

  it('clears an unpaid status notice when a later automatic check confirms payment', async () => {
    vi.useFakeTimers();
    render(<BookingManagementPage />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check payment status' })); });
    expect(screen.getByText(/We haven't recorded your deposit yet/)).toBeInTheDocument();
    vi.mocked(fetch).mockResolvedValue(result({ ...offered, state: 'confirmed', paidPence: 3000, balancePence: 5500, canPayDeposit: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole('heading', { name: 'Your clean is booked' })).toBeInTheDocument();
    expect(screen.queryByText(/We haven't recorded your deposit yet/)).not.toBeInTheDocument();
  });
});
