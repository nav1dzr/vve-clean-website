import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogueListPage from './CatalogueListPage';
import type { CatalogueItem } from '../types/catalogue';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args), ApiError: class extends Error {} }));
const item = (id: string, name: string, status: 'active' | 'archived' = 'active'): CatalogueItem => ({
  id, name, status, defaultPricePence: 8500, itemType: 'service', category: null, description: null, createdAt: '', updatedAt: '',
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('CatalogueListPage request recovery', () => {
  beforeEach(() => { authFetchMock.mockReset(); });

  it('ignores a late active-list response after switching to archived', async () => {
    const user = userEvent.setup();
    const active = deferred<{ results: CatalogueItem[] }>();
    authFetchMock.mockImplementation((path: string) => path.includes('status=active') ? active.promise : Promise.resolve({ results: [item('archived', 'Archived synthetic item', 'archived')] }));
    render(<CatalogueListPage />);
    await user.click(screen.getByRole('button', { name: 'archived' }));
    await screen.findByText('Archived synthetic item');
    await act(async () => { active.resolve({ results: [item('active', 'Stale active item')] }); });
    expect(screen.getByText('Archived synthetic item')).toBeInTheDocument();
    expect(screen.queryByText('Stale active item')).not.toBeInTheDocument();
  });

  it('ignores late search errors after a newer search succeeded', async () => {
    const user = userEvent.setup();
    const oldSearch = deferred<{ results: CatalogueItem[] }>();
    authFetchMock.mockImplementation((path: string) => path.includes('q=carpet') ? oldSearch.promise : Promise.resolve({ results: path.includes('q=sofa') ? [item('sofa', 'Sofa synthetic item')] : [] }));
    render(<CatalogueListPage />);
    await user.type(screen.getByRole('searchbox'), 'carpet');
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledWith('/api/catalogue?status=active&q=carpet'));
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'sofa');
    await screen.findByText('Sofa synthetic item');
    await act(async () => { oldSearch.reject(new Error('late failure')); });
    expect(screen.getByText('Sofa synthetic item')).toBeInTheDocument();
    expect(screen.queryByText('Could not load catalogue items.')).not.toBeInTheDocument();
  });

  it('retries a failed list request and shows the recovered result', async () => {
    const user = userEvent.setup();
    authFetchMock.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce({ results: [item('recovered', 'Recovered item')] });
    render(<CatalogueListPage />);
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Recovered item')).toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes the current filter after an earlier archive finishes and names the completed action', async () => {
    const user = userEvent.setup();
    const archive = deferred<unknown>();
    authFetchMock.mockImplementation((path: string, options?: { method?: string }) => options?.method === 'PATCH' ? archive.promise : Promise.resolve({ results: path.includes('status=active') ? [item('one', 'Synthetic carpet')] : [item('two', 'Existing archived item', 'archived')] }));
    render(<CatalogueListPage />);
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await user.click(screen.getByRole('button', { name: 'archived' }));
    await screen.findByText('Existing archived item');
    await act(async () => { archive.resolve(item('one', 'Synthetic carpet', 'archived')); });
    expect(await screen.findByRole('status')).toHaveTextContent('Synthetic carpet archived.');
    await waitFor(() => expect(authFetchMock.mock.calls[authFetchMock.mock.calls.length - 1]?.[0]).toBe('/api/catalogue?status=archived'));
    expect(screen.getByText('Existing archived item')).toBeInTheDocument();
  });

  it('keeps a newly opened form when an earlier save finishes and reports the saved item', async () => {
    const user = userEvent.setup();
    const save = deferred<unknown>();
    authFetchMock.mockImplementation((_path: string, options?: { method?: string }) => options?.method === 'PATCH' ? save.promise : Promise.resolve({ results: [item('one', 'Synthetic carpet')] }));
    render(<CatalogueListPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: '+ New item' }));
    await user.type(screen.getByLabelText('Name *'), 'Next synthetic item');
    await act(async () => { save.resolve(item('one', 'Synthetic carpet')); });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('New catalogue item');
    expect(screen.getByLabelText('Name *')).toHaveValue('Next synthetic item');
    expect(screen.getByRole('status')).toHaveTextContent('Synthetic carpet saved.');
  });

  it('returns focus to the actual edit button after Escape', async () => {
    const user = userEvent.setup();
    authFetchMock.mockResolvedValue({ results: [item('one', 'Synthetic carpet')] });
    render(<CatalogueListPage />);
    const edit = await screen.findByRole('button', { name: 'Edit' });
    await user.click(edit);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(edit).toHaveFocus();
  });
});
