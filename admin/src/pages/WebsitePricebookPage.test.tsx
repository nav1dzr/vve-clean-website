import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebsitePricebookPage from './WebsitePricebookPage';
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../lib/authFetch', () => ({ authFetch: fetchMock }));
const fields = [{ key: 'CARPET_ITEM_PRICES_P.bedroom', pence: 5000 }];
const examples = [{ label: 'Two bedroom carpets', pence: 10000 }];
const draft = { id: 'saved-draft', label: 'Website prices', overrides: { CARPET_ITEM_PRICES_P: { bedroom: 6000 } }, created_at: '2026-09-08T00:00:00Z', published_at: null };
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_path: string, options?: RequestInit) => {
    if (!options?.body) return { current: { id: 'bundled', overrides: {} }, fields, examples, versions: [], publications: [], refreshReady: true };
    const body = JSON.parse(String(options.body));
    if (body.action === 'save-draft') return { fields: [{ ...fields[0], pence: 6000 }], examples: [{ ...examples[0], pence: 12000 }], draft };
    if (body.action === 'preview') return { fields, examples };
    return { message: 'Published for new visits; snapshot refresh requested.' };
  });
});
describe('CRM website price review', () => {
  it('saves and reviews changed prices before enabling publication, and invalidates review on further editing', async () => {
    const user = userEvent.setup(); render(<WebsitePricebookPage />);
    await screen.findByText('Current list: original website prices');
    await user.type(screen.getByRole('searchbox'), 'bedroom');
    const amount = screen.getByLabelText(/Carpet and upholstery items · bedroom/);
    await user.clear(amount); await user.type(amount, '60.00');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    const publish = await screen.findByRole('button', { name: 'Publish this saved price list' });
    expect(publish).toBeEnabled();
    expect(screen.getByText('£120.00')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([, options]) => options?.body && JSON.parse(options.body).action === 'save-draft');
    expect(JSON.parse(call![1].body).overrides.CARPET_ITEM_PRICES_P.bedroom).toBe(6000);
    await user.clear(amount); await user.type(amount, '65');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publish this saved price list' })).not.toBeInTheDocument());
  });
  it('does not offer deposit, policy or coverage fields', async () => {
    render(<WebsitePricebookPage />); await screen.findByText('Current list: original website prices');
    expect(screen.queryByRole('textbox', { name: /deposit|coverage|guarantee/i })).not.toBeInTheDocument();
    expect(screen.getByText(/£30 deposit, coverage, payment policies, guarantee and discount rules are protected/i)).toBeInTheDocument();
  });
});
