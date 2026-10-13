import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EotQuoteWizard, { type EotBookingResult } from './EotQuoteWizard';
import QuoteCalculator from './QuoteCalculator';
import BookingPage from '../pages/BookingPage';
import { BookingProvider } from '../context/BookingContext';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { clearQuoteBasket, readQuoteBasket, saveQuoteBasket } from '../lib/quoteBasket';
import { EOT_PRICES_P } from '../data/pricing';

const baseQuote: EotBookingResult['quoteConfig'] = {
  service: 'deep', deepService: 'end_of_tenancy', deepSize: 'bed2', deepBaths: 1, deepWcs: 0, isHouse: false,
  eotPackage: 'complete',
  tailoredAddOns: { microwaveInside: false, fridgeFreezerInside: false, extraFridgeFreezers: 0, dishwasherInside: false, washingMachineInside: false, cupboards: false },
  addOnCounts: {}, rooms: [], carpetRoomIds: [], windowSize: 'small', gutterType: 'terraced', officeHours: 2, condition: 'normal',
};
const selectionError = 'Choose at least one carpet area, or select Standard floor care.';
type User = ReturnType<typeof userEvent.setup>;
async function next(user: User) {
  await user.click(screen.getByRole('button', { name: /^Continue$/ }));
}
async function floorCare(user: User) {
  await next(user);
  await next(user);
}
async function professional(user: User) {
  await user.click(screen.getByRole('button', { name: /^Professional carpet steam cleaning/ }));
}
async function assertBlocked(user: User) {
  await next(user);
  const alert = screen.getByRole('alert');
  expect(alert).toHaveTextContent(selectionError);
  await waitFor(() => expect(alert).toHaveFocus());
  expect(screen.getByRole('list', { name: 'Step 3 of 4: Floor care' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Request a time/ })).not.toBeInTheDocument();
}

beforeEach(() => {
  clearQuoteBasket();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/end-of-tenancy-cleaning-london');
});

describe('EOT return-to-quote preserves selected additional areas', () => {
  it('retains added reception, hallway and landing IDs, totals and hand-off after the real Back to quote link', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
        <CookieConsentProvider><BookingProvider><Routes>
          <Route path="/end-of-tenancy-cleaning-london" element={<QuoteCalculator mode="eot" />} />
          <Route path="/booking" element={<BookingPage />} />
        </Routes></BookingProvider></CookieConsentProvider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /^2 beds$/ }));
    await floorCare(user);
    await professional(user);
    await user.click(screen.getByRole('button', { name: /Whole-property carpet cleaning/ }));
    for (const name of ['+ Reception room', '+ Hallway', '+ Landing']) {
      await user.click(screen.getByRole('button', { name }));
    }
    await next(user);
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    const first = JSON.parse(sessionStorage.getItem('vve_booking')!);
    const extraIds = first.quoteConfig.carpetRoomIds.filter((id: string) => /^(reception|hallway|landing)-\d+$/.test(id));
    expect(extraIds).toHaveLength(3);
    await user.click(screen.getByRole('link', { name: 'Back to quote' }));
    expect(screen.getByRole('list', { name: 'Step 4 of 4: Review' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    for (const name of ['Additional reception room', 'Additional hallway', 'Additional landing']) {
      expect(screen.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked();
    }
    await next(user);
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    const restored = JSON.parse(sessionStorage.getItem('vve_booking')!);
    expect(restored.price).toBe(first.price);
    expect(restored.quoteConfig.carpetRoomIds).toEqual(first.quoteConfig.carpetRoomIds);
    expect(restored.quoteConfig.rooms).toEqual(first.quoteConfig.rooms);
    expect(new Set(restored.quoteConfig.carpetRoomIds).size).toBe(restored.quoteConfig.carpetRoomIds.length);
  });

  it('does not charge unchecked extras, hard-floor extras, unknown IDs or mismatched area keys', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} restoreConfig={{
      ...baseQuote,
      rooms: [
        { id: 'reception-1', addonKey: 'living_room', floor: 'carpet' },
        { id: 'reception-2', addonKey: 'living_room', floor: 'carpet' },
        { id: 'hallway-3', addonKey: 'hallway', floor: 'hard' },
        { id: 'unknown-4', addonKey: 'hallway', floor: 'carpet' },
        { id: 'landing-5', addonKey: 'living_room', floor: 'carpet' },
      ],
      carpetRoomIds: ['reception-1', 'hallway-3', 'unknown-4', 'landing-5'],
    }} />);
    await floorCare(user);
    expect(screen.getAllByRole('checkbox').filter(input => (input as HTMLInputElement).checked)).toHaveLength(1);
    await next(user);
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    expect(onBook.mock.calls[0][0].quoteConfig.carpetRoomIds).toEqual(['reception-1']);
  });

  it('preserves manual area counts and multiple stair flights through the same hand-off format', async () => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    const first = render(<EotQuoteWizard onBook={onBook} restoreConfig={baseQuote} />);
    await floorCare(user);
    await professional(user);
    await user.click(screen.getByRole('button', { name: /Choose areas individually/ }));
    for (const name of ['Bedrooms', 'Bedrooms', 'Living rooms', 'staircase flights', 'staircase flights']) {
      await user.click(screen.getByRole('button', { name: `Increase ${name}` }));
    }
    await next(user);
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    const result: EotBookingResult = onBook.mock.calls[0][0];
    first.unmount();
    render(<EotQuoteWizard onBook={onBook} restoreConfig={result.quoteConfig} />);
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    expect(onBook.mock.calls[1][0]).toEqual(result);
  });

  it.each([
    ['null room', [null], ['reception-1']],
    ['duplicate rooms', [{ id: 'reception-1', addonKey: 'living_room', floor: 'carpet' }, { id: 'reception-1', addonKey: 'living_room', floor: 'carpet' }], ['reception-1']],
    ['oversized room list', Array.from({ length: 81 }, (_, i) => ({ id: `reception-${i}`, addonKey: 'living_room', floor: 'carpet' })), ['reception-1']],
    ['unknown area key', [{ id: 'reception-1', addonKey: 'unexpected', floor: 'carpet' }], ['reception-1']],
    ['invalid floor', [{ id: 'reception-1', addonKey: 'living_room', floor: 'invalid' }], ['reception-1']],
    ['invalid stair count', [{ id: 'reception-1', addonKey: 'living_room', floor: 'carpet', stairFlights: -1 }], ['reception-1']],
    ['oversized ID', [{ id: 'x'.repeat(100), addonKey: 'living_room', floor: 'carpet' }], ['x'.repeat(100)]],
    ['non-string selection', [{ id: 'reception-1', addonKey: 'living_room', floor: 'carpet' }], [null]],
    ['duplicate selections', [{ id: 'reception-1', addonKey: 'living_room', floor: 'carpet' }], ['reception-1', 'reception-1']],
  ])('rejects %s without crashing or adding charges', (_name, rooms, carpetRoomIds) => {
    const restoreConfig = { ...baseQuote, rooms, carpetRoomIds } as unknown as EotBookingResult['quoteConfig'];
    render(<EotQuoteWizard onBook={vi.fn()} restoreConfig={restoreConfig} />);
    expect(screen.getByTestId('footer-total')).toHaveTextContent(`£${EOT_PRICES_P.flat.bed2.complete / 100}`);
  });
});

describe('professional carpet care requires actual selected areas', () => {
  it('blocks an unset selection, focuses each failed attempt, and clears the error after an area is selected', async () => {
    const user = userEvent.setup();
    render(<EotQuoteWizard onBook={vi.fn()} restoreConfig={baseQuote} />);
    await floorCare(user);
    await professional(user);
    await assertBlocked(user);
    await assertBlocked(user);
    await user.click(screen.getByRole('button', { name: /Choose areas individually/ }));
    await assertBlocked(user);
    await user.click(screen.getByRole('button', { name: 'Increase Bedrooms' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await next(user);
    expect(screen.getByRole('button', { name: /Request a time/ })).toBeInTheDocument();
  });

  it('blocks a whole-property selection after every suggested area is unticked', async () => {
    const user = userEvent.setup();
    render(<EotQuoteWizard onBook={vi.fn()} restoreConfig={baseQuote} />);
    await floorCare(user);
    await professional(user);
    await user.click(screen.getByRole('button', { name: /Whole-property carpet cleaning/ }));
    for (const input of screen.getAllByRole('checkbox')) {
      if ((input as HTMLInputElement).checked) await user.click(input);
    }
    await assertBlocked(user);
  });

  it.each(['Standard floor care', 'No carpeted areas'])('allows the valid included choice %s after a selection error', async name => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    render(<EotQuoteWizard onBook={onBook} restoreConfig={baseQuote} />);
    await floorCare(user);
    await professional(user);
    await assertBlocked(user);
    await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await next(user);
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    expect(onBook.mock.calls[0][0].quoteConfig.carpetRoomIds).toEqual([]);
    expect(onBook.mock.calls[0][0].price).toBe(EOT_PRICES_P.flat.bed2.complete / 100);
  });

  it('clears the error when going back', async () => {
    const user = userEvent.setup();
    render(<EotQuoteWizard onBook={vi.fn()} restoreConfig={baseQuote} />);
    await floorCare(user);
    await professional(user);
    await assertBlocked(user);
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Step 2 of 4: Package' })).toBeInTheDocument();
  });

  it.each(['unset', 'manual', 'whole'])('prevents a saved invalid %s review bypassing the final hand-off', async carpetMode => {
    const user = userEvent.setup();
    const onBook = vi.fn();
    const first = render(<EotQuoteWizard onBook={onBook} restoreConfig={baseQuote} />);
    await floorCare(user);
    await next(user);
    const basket = readQuoteBasket()!;
    first.unmount();
    saveQuoteBasket({ ...basket, config: { ...basket.config, floorCareChoice: 'professional', carpetMode, rooms: [] }, step: 4 });
    render(<EotQuoteWizard onBook={onBook} />);
    expect(screen.getByText('Choose carpet areas before continuing')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Request a time/ }));
    expect(onBook).not.toHaveBeenCalled();
    expect(screen.getByRole('list', { name: 'Step 3 of 4: Floor care' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent(selectionError);
  });
});
