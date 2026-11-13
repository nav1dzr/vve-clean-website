import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuoteCalculator, { type BookingSelection } from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';
import { priceBookingRequest } from '../../shared/requestPricing.js';
import { formatBookingItemLines } from '../../api/_lib/formatBookingItems.js';

// The price a customer is shown must be the price the server saves. The
// request endpoint recalculates every total from the submitted selection
// (shared/requestPricing.js) and ignores the browser's figure, so any extra
// the calculator can add but the server does not recognise silently lowers
// the saved request. That happened with the move-in upholstery extras: the
// calculator added £45–£130, the server added £0.
//
// This drives the real calculator through every extra it offers for a move-in
// clean, so a new extra cannot be added to the screen without also being
// priced and named by the server.

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
});

const ACCESS = { parkingAvailable: 'yes', congestionZone: 'no' } as const;

function renderMoveIn() {
  const onBook = vi.fn<(selection: BookingSelection) => void>();
  render(
    <MemoryRouter>
      <BookingProvider>
        <QuoteCalculator onBook={onBook} homepageMode homepageService="move_in" aboveFold />
      </BookingProvider>
    </MemoryRouter>,
  );
  return onBook;
}

const extraButtons = () => screen.getAllByRole('button', { name: /^Increase .+ quantity$/ });
const extraName = (button: HTMLElement) => button.getAttribute('aria-label')!.replace(/^Increase /, '').replace(/ quantity$/, '');

function requestSelection(onBook: ReturnType<typeof renderMoveIn>): BookingSelection {
  fireEvent.click(screen.getAllByRole('button', { name: 'Request a time — no payment' })[0]);
  expect(onBook).toHaveBeenCalledTimes(1);
  return onBook.mock.calls[0][0];
}

function serverTotal(selection: BookingSelection) {
  return priceBookingRequest({ ...selection.quoteConfig, ...ACCESS })?.total;
}

// Read once from the rendered calculator so the list below is whatever the
// customer can actually select, not a copy that could fall out of date.
renderMoveIn();
const MOVE_IN_EXTRAS = extraButtons().map(extraName);
cleanup();

describe('move-in clean: shown price equals the saved request price', () => {
  it('offers the upholstery and mattress extras this guard exists for', () => {
    expect(MOVE_IN_EXTRAS).toEqual(expect.arrayContaining([
      '2-seater sofa steam clean', '3-seater sofa steam clean', 'Corner / L-shaped sofa steam clean',
      'Single mattress steam clean', 'Double mattress steam clean',
    ]));
  });

  it('matches with no extras selected', () => {
    const selection = requestSelection(renderMoveIn());
    expect(serverTotal(selection)).toBe(selection.price);
  });

  it.each(MOVE_IN_EXTRAS)('matches when "%s" is added', (name) => {
    const onBook = renderMoveIn();
    const base = requestSelection(onBook).price;
    onBook.mockClear();

    fireEvent.click(screen.getByRole('button', { name: `Increase ${name} quantity` }));
    const selection = requestSelection(onBook);

    // The extra must change the price the customer sees…
    expect(selection.price).toBeGreaterThan(base);
    // …and the server must save exactly that price.
    expect(serverTotal(selection)).toBe(selection.price);
    // Staff must be told what was chosen in plain words, never a raw key such
    // as "Eot Sofa 3".
    const lines = formatBookingItemLines({ ...selection.quoteConfig, ...ACCESS });
    expect(lines.join('\n')).not.toMatch(/\bEot\b/);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('matches when every extra is added together, twice', () => {
    const onBook = renderMoveIn();
    for (const button of extraButtons()) {
      fireEvent.click(button);
      if (!(button as HTMLButtonElement).disabled) fireEvent.click(button);
    }
    const selection = requestSelection(onBook);
    expect(serverTotal(selection)).toBe(selection.price);
  });

  it('keeps the example from the audit: 2 bed with a 3-seater sofa is £344 on screen and on the server', () => {
    const onBook = renderMoveIn();
    fireEvent.click(screen.getByRole('button', { name: 'Increase 3-seater sofa steam clean quantity' }));
    const selection = requestSelection(onBook);
    expect(selection.price).toBe(344);
    expect(serverTotal(selection)).toBe(344);
  });
});
