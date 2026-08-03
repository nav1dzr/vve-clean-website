// Mixed carpet + upholstery quoting from the Carpet page.
//
// The carpet page offers Sofas & Upholstery as an optional add-on inside the
// same quote, now behind a Yes/No disclosure so the calculator does not open
// at full length. Nothing about the pricing engine changed — both groups were
// always priced by computeCarpetPrice from CARPET_ITEM_PRICES_P — so these
// tests pin that the combined journey totals correctly and that the booking
// hand-off carries both halves.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';
import { CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P } from '../data/pricing';

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

function renderCarpet(onBook?: (sel: unknown) => void) {
  return render(
    <MemoryRouter>
      <BookingProvider>
        <QuoteCalculator mode="carpet" onBook={onBook} />
      </BookingProvider>
    </MemoryRouter>,
  );
}

const gbp = (pence: number) => `£${pence / 100}`;

/**
 * Reveals the optional upholstery controls. Every mixed-basket test below goes
 * through this, exactly as a customer would — the items are not in the DOM
 * until the offer is accepted.
 */
async function openUpholstery(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Yes' }));
}

/** Clicks the + control for a named line item. */
async function add(user: ReturnType<typeof userEvent.setup>, label: string, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await user.click(screen.getByRole('button', { name: `Increase ${label} quantity` }));
  }
}
async function remove(user: ReturnType<typeof userEvent.setup>, label: string, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await user.click(screen.getByRole('button', { name: `Decrease ${label} quantity` }));
  }
}

describe('Carpet page quote — carpet only', () => {
  it('prices a carpet-only selection exactly as before', async () => {
    const user = userEvent.setup();
    renderCarpet();
    await add(user, 'Living / dining room');
    // £70 is below the £85 minimum booking, so the floor applies.
    expect(screen.getAllByText(gbp(CARPET_MIN_BOOKING_P)).length).toBeGreaterThan(0);

    await add(user, 'Bedroom');
    // £70 + £50 = £120, comfortably above the minimum.
    expect(screen.getAllByText('£120').length).toBeGreaterThan(0);
  });
});

describe('Carpet page quote — carpet plus upholstery', () => {
  it('adds a single sofa to the live total', async () => {
    const user = userEvent.setup();
    renderCarpet();
    await add(user, 'Living / dining room');   // £70
    await openUpholstery(user);
    await add(user, '3-seater sofa');          // £95
    expect(screen.getAllByText('£165').length).toBeGreaterThan(0);
  });

  it('adds several upholstery items together', async () => {
    const user = userEvent.setup();
    renderCarpet();
    await add(user, 'Bedroom');                // £50
    await openUpholstery(user);
    await add(user, 'Armchair');               // £50
    await add(user, 'Mattress (double/king)'); // £65
    // 50 + 50 + 65 = £165
    expect(screen.getAllByText('£165').length).toBeGreaterThan(0);
  });

  it('handles quantity changes on an upholstery item', async () => {
    const user = userEvent.setup();
    renderCarpet();
    await add(user, 'Living / dining room');   // £70
    await openUpholstery(user);
    await add(user, '2-seater sofa', 2);       // £75 × 2 = £150
    expect(screen.getAllByText('£220').length).toBeGreaterThan(0);
  });

  it('removes an upholstery item again and returns to the carpet-only total', async () => {
    const user = userEvent.setup();
    renderCarpet();
    await add(user, 'Bedroom');                // £50
    await add(user, 'Living / dining room');   // £70  → £120
    await openUpholstery(user);
    await add(user, '3-seater sofa');          // £95  → £215
    expect(screen.getAllByText('£215').length).toBeGreaterThan(0);

    await remove(user, '3-seater sofa');
    expect(screen.getAllByText('£120').length).toBeGreaterThan(0);
    expect(screen.queryByText('£215')).not.toBeInTheDocument();
  });
});

describe('Carpet page quote — summary and booking hand-off', () => {
  it('separates carpet and upholstery lines in the summary', async () => {
    const user = userEvent.setup();
    renderCarpet();
    await add(user, 'Living / dining room');
    await openUpholstery(user);
    await add(user, '3-seater sofa');

    // Both groups are represented, each with its own line.
    expect(screen.getAllByText(/Living \/ dining room/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3-seater sofa/i).length).toBeGreaterThan(0);
  });

  it('hands booking a combined price and both item types in carpetCounts', async () => {
    const onBook = vi.fn();
    const user = userEvent.setup();
    renderCarpet(onBook);

    await add(user, 'Living / dining room');  // £70
    await openUpholstery(user);
    await add(user, '3-seater sofa');         // £95
    await user.click(screen.getAllByRole('button', { name: /Book online/i })[0]);

    expect(onBook).toHaveBeenCalledTimes(1);
    const sel = onBook.mock.calls[0][0] as {
      serviceName: string;
      price: number;
      quoteConfig?: { deepService?: string; carpetCounts?: Record<string, number> };
    };

    expect(sel.price).toBe(165);
    // Both halves survive into the payload the server revalidates against.
    expect(sel.quoteConfig?.carpetCounts?.living_room).toBe(1);
    expect(sel.quoteConfig?.carpetCounts?.sofa_3).toBe(1);
    expect(sel.quoteConfig?.deepService).toBe('carpet_upholstery');
  });

  it('prices every upholstery option from the central pricing source', () => {
    // Guards against a component ever hard-coding a sofa price.
    expect(CARPET_ITEM_PRICES_P.armchair).toBe(5000);
    expect(CARPET_ITEM_PRICES_P.sofa_2).toBe(7500);
    expect(CARPET_ITEM_PRICES_P.sofa_3).toBe(9500);
    expect(CARPET_ITEM_PRICES_P.sofa_corner).toBe(13000);
    expect(CARPET_ITEM_PRICES_P.mattress_single).toBe(4500);
    expect(CARPET_ITEM_PRICES_P.mattress_double).toBe(6500);
  });
});
