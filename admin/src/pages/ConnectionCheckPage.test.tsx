import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ConnectionCheckPage from './ConnectionCheckPage';
const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: authFetchMock }));
const bounds = () => ({ opensAt: new Date(Date.now() - 1000).toISOString(), closesAt: new Date(Date.now() - 1000 + 1800000).toISOString() });
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T00:14:59Z')); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
describe('private one-click check', () => {
  it('starts closed with no automatic request', () => {
    render(<ConnectionCheckPage />); expect(screen.getByRole('button')).toBeDisabled(); expect(authFetchMock).not.toHaveBeenCalled();
  });
  it('makes exactly one manual request with redirects rejected', async () => {
    authFetchMock.mockResolvedValue({ runtime: 'crm', databaseRef: 'abcdefghijklmnopqrst', databaseReferencesMatch: true, website: { runtime: 'website', databaseRef: 'abcdefghijklmnopqrst', contactDatabaseRef: 'abcdefghijklmnopqrst', status: 'refresh_succeeded', refreshSucceeded: true, scopeKnown: false } });
    render(<ConnectionCheckPage {...bounds()} />); expect(authFetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button')); fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Google refresh: Succeeded')).toBeInTheDocument());
    expect(authFetchMock).toHaveBeenCalledTimes(1); expect(authFetchMock).toHaveBeenCalledWith('/api/connection-check', { method: 'POST', redirect: 'error', body: '{"action":"check"}' });
    expect(screen.getByRole('button')).toBeDisabled(); expect(screen.getByText(/Unknown — Google/)).toBeInTheDocument();
  });
  it('opens at the approved start without automatically requesting', () => {
    vi.setSystemTime(new Date('2026-10-25T00:15:00Z'));
    render(<ConnectionCheckPage />); expect(screen.getByRole('button')).toBeEnabled(); expect(authFetchMock).not.toHaveBeenCalled();
  });
  it.each(['2026-10-25T00:45:00Z', '2026-10-25T01:15:00Z'])('stays closed at expiry and in the repeated GMT hour: %s', time => {
    vi.setSystemTime(new Date(time));
    render(<ConnectionCheckPage />); expect(screen.getByRole('button')).toBeDisabled(); expect(authFetchMock).not.toHaveBeenCalled();
  });
  it.each([null, '<html>not JSON</html>', {}, { website: null }, { runtime: 'crm', website: { refreshSucceeded: 'yes' } }])('locks and warns on invalid response %j', async response => {
    authFetchMock.mockResolvedValue(response);
    render(<ConnectionCheckPage {...bounds()} />); fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toContain('Do not repeat'); expect(screen.getByRole('button')).toBeDisabled();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not display raw errors or invite retries after unknown outcomes', async () => {
    authFetchMock.mockRejectedValue(new Error('private token'));
    render(<ConnectionCheckPage {...bounds()} />); fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toContain('Do not repeat'); expect(screen.queryByText(/private token/)).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled(); expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
});
