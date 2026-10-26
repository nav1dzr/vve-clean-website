import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import AdsValidationPage from './AdsValidationPage';
const authFetch = vi.hoisted(() => vi.fn());
const getAdsValidationReadiness = vi.hoisted(() => vi.fn());
vi.mock('../lib/authFetch', () => ({ authFetch }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('../lib/adsValidationReadiness', async importOriginal => ({ ...await importOriginal<typeof import('../lib/adsValidationReadiness')>(), getAdsValidationReadiness }));
beforeEach(() => { cleanup(); sessionStorage.clear(); authFetch.mockReset(); getAdsValidationReadiness.mockReset(); });
describe('private validation UI', () => {
  it('closed response never enables a provider attempt', async () => {
    getAdsValidationReadiness.mockRejectedValue(new Error('closed')); render(<AdsValidationPage />);
    await screen.findByText(/closed or unavailable/);
    expect(screen.getByRole('button')).toBeDisabled(); expect(getAdsValidationReadiness).toHaveBeenCalledTimes(1); expect(authFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
  it('unknown POST stays disabled without retry, including remount', async () => {
    getAdsValidationReadiness.mockResolvedValueOnce({ status: 'ready' }); authFetch.mockRejectedValueOnce(new Error('timeout'));
    const view = render(<AdsValidationPage />);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    fireEvent.click(screen.getByRole('button')); fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/result is unavailable or uncertain/);
    expect(screen.getByRole('button')).toBeDisabled(); expect(authFetch).toHaveBeenCalledTimes(1);
    view.unmount(); render(<AdsValidationPage />);
    await screen.findByText(/already requested/); expect(screen.getByRole('button')).toBeDisabled();
    expect(authFetch).toHaveBeenCalledTimes(1); expect(getAdsValidationReadiness).toHaveBeenCalledTimes(1);
  });
  it('consumed server status disables button', async () => {
    getAdsValidationReadiness.mockResolvedValueOnce({ status: 'consumed' }); render(<AdsValidationPage />);
    await screen.findByText(/already been consumed/); expect(screen.getByRole('button')).toBeDisabled();
  });
  it('validation message does not claim ingestion', async () => {
    getAdsValidationReadiness.mockResolvedValueOnce({ status: 'ready' }); authFetch.mockResolvedValueOnce({ status: 'validated', warningCount: 1 });
    render(<AdsValidationPage />); await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/does not prove conversion delivery/); expect(screen.getByRole('button')).toBeDisabled();
  });
  it.each([
    ['CLAIM_LOOKUP_FAILED', 'website', 'unavailable', /could not check the existing diagnostic claim/],
    ['FORWARD_RESPONSE_INVALID', 'crm', 'unavailable', /could not verify the Website readiness response/],
    ['UPSTREAM_CLOSED', 'crm', 'closed', /specific cause is not disclosed/],
  ])('renders safe non-success reason %s without enabling action', async (reason, stage, status, message) => {
    getAdsValidationReadiness.mockResolvedValueOnce({ status, reason, stage });
    render(<AdsValidationPage />); await screen.findByText(message);
    expect(screen.getByRole('button')).toBeDisabled(); expect(authFetch).not.toHaveBeenCalled();
  });
});
