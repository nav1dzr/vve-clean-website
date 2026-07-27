import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceItemsForm, { emptyFormValue } from './InvoiceItemsForm';
import type { CatalogueItem } from '../types/catalogue';

// The catalogue combobox fetches via authFetch — mocked here, same pattern
// as BookingDetailPage.test.tsx (never import the real module: it would
// load supabase.ts, which throws without env vars).
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

const CATALOGUE_ITEMS: CatalogueItem[] = [
  {
    id: 'item-1',
    name: 'Bedroom carpet clean',
    description: null,
    defaultPricePence: 5000,
    itemType: 'service',
    category: 'Carpets',
    status: 'active',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  },
  {
    id: 'item-2',
    name: 'Commercial / office cleaning (per hour)',
    description: 'Minimum 4 hours per visit.',
    defaultPricePence: 2250,
    itemType: 'service',
    category: 'Commercial',
    status: 'active',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  },
];

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <InvoiceItemsForm
      initial={emptyFormValue()}
      onSubmit={onSubmit}
      submitLabel="Create invoice"
      submitting={false}
      error={null}
    />,
  );
  return onSubmit;
}

async function pickCatalogueOption(name: string) {
  const user = userEvent.setup();
  const combobox = screen.getByTestId('catalogue-combobox');
  await user.click(combobox);
  await user.type(combobox, name.split(' ')[0]);
  const optionText = await screen.findByText(name);
  await user.click(optionText.closest('[role="option"]') as HTMLElement);
  return user;
}

describe('InvoiceItemsForm — catalogue selector', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    authFetchMock.mockImplementation((path: string) => {
      if (path.startsWith('/api/catalogue')) {
        return Promise.resolve({ results: CATALOGUE_ITEMS });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });
  });

  it('selecting a catalogue item appends a new line prefilled with name, quantity 1 and the exact pence price', async () => {
    renderForm();
    await pickCatalogueOption('Bedroom carpet clean');

    const descriptions = screen.getAllByLabelText('Description') as HTMLInputElement[];
    expect(descriptions).toHaveLength(2);
    expect(descriptions[1].value).toBe('Bedroom carpet clean');

    const qtyInputs = screen.getAllByLabelText('Qty') as HTMLInputElement[];
    expect(qtyInputs[1].value).toBe('1');

    // 5000 pence → exactly £50, no floating-point drift.
    const priceInputs = screen.getAllByLabelText('Unit price (£)') as HTMLInputElement[];
    expect(priceInputs[1].value).toBe('50');
  });

  it('appends name plus description when the catalogue item has one, with exact non-whole-pound pricing', async () => {
    renderForm();
    await pickCatalogueOption('Commercial / office cleaning (per hour)');

    const descriptions = screen.getAllByLabelText('Description') as HTMLInputElement[];
    expect(descriptions[1].value).toBe('Commercial / office cleaning (per hour) — Minimum 4 hours per visit.');

    // 2250 pence → exactly £22.50.
    const priceInputs = screen.getAllByLabelText('Unit price (£)') as HTMLInputElement[];
    expect(priceInputs[1].value).toBe('22.5');
  });

  it('editing the appended line never mutates the catalogue (no write call to /api/catalogue)', async () => {
    renderForm();
    const user = await pickCatalogueOption('Bedroom carpet clean');
    authFetchMock.mockClear();

    const descriptions = screen.getAllByLabelText('Description') as HTMLInputElement[];
    await user.clear(descriptions[1]);
    await user.type(descriptions[1], 'Custom edited line text');

    const priceInputs = screen.getAllByLabelText('Unit price (£)') as HTMLInputElement[];
    await user.clear(priceInputs[1]);
    await user.type(priceInputs[1], '65');

    const writeCalls = authFetchMock.mock.calls.filter((call) => {
      const [path, init] = call as [string, RequestInit?];
      return path.startsWith('/api/catalogue') && init?.method && init.method !== 'GET';
    });
    expect(writeCalls).toHaveLength(0);
  });

  it('keeps the manual "+ Add item" flow working alongside the catalogue selector', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    const descriptions = screen.getAllByLabelText('Description') as HTMLInputElement[];
    expect(descriptions).toHaveLength(2);
    expect(descriptions[1].value).toBe('');
  });

  it('the appended catalogue line is submitted as a plain editable line item', async () => {
    const onSubmit = renderForm();
    const user = await pickCatalogueOption('Bedroom carpet clean');

    // Fill the default empty first line and the required customer fields.
    const descriptions = screen.getAllByLabelText('Description') as HTMLInputElement[];
    await user.type(descriptions[0], 'Manual first line');
    await user.type(screen.getByLabelText(/Name \*/), 'Test Customer');
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0];
    const catalogueLine = input.items.find((i: { description: string }) => i.description === 'Bedroom carpet clean');
    expect(catalogueLine).toBeDefined();
    expect(catalogueLine).toMatchObject({ quantity: 1, unitPrice: 50, lineDiscount: 0 });
    // No catalogue id leaks into the invoice payload.
    expect(catalogueLine).not.toHaveProperty('catalogueItemId');
    expect(catalogueLine).not.toHaveProperty('id');
  });
});
