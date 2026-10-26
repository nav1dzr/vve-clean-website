import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import AdsValidationPage from './AdsValidationPage';
const authFetch = vi.hoisted(() => vi.fn());
vi.mock('../lib/authFetch', () => ({ authFetch }));
beforeEach(() => { cleanup(); sessionStorage.clear(); authFetch.mockReset(); });
describe('private validation UI', () => {
  it('closed response never enables a provider attempt', async () => {
    authFetch.mockRejectedValue(new Error('closed')); render(<AdsValidationPage />);
    await screen.findByText(/closed or unavailable/);
    expect(screen.getByRole('button')).toBeDisabled(); expect(authFetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
  it('unknown POST stays disabled without retry, including remount', async () => {
    authFetch.mockResolvedValueOnce({ status: 'ready' }).mockRejectedValueOnce(new Error('timeout'));
    const view = render(<AdsValidationPage />);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    fireEvent.click(screen.getByRole('button')); fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/result is unavailable or uncertain/);
    expect(screen.getByRole('button')).toBeDisabled(); expect(authFetch).toHaveBeenCalledTimes(2);
    view.unmount(); render(<AdsValidationPage />);
    await screen.findByText(/already requested/); expect(screen.getByRole('button')).toBeDisabled();
    expect(authFetch).toHaveBeenCalledTimes(2);
  });
  it('consumed server status disables button', async () => {
    authFetch.mockResolvedValueOnce({ status: 'consumed' }); render(<AdsValidationPage />);
    await screen.findByText(/already been consumed/); expect(screen.getByRole('button')).toBeDisabled();
  });
  it('validation message does not claim ingestion', async () => {
    authFetch.mockResolvedValueOnce({ status: 'ready' }).mockResolvedValueOnce({ status: 'validated', warningCount: 1 });
    render(<AdsValidationPage />); await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/does not prove conversion delivery/); expect(screen.getByRole('button')).toBeDisabled();
  });
});
