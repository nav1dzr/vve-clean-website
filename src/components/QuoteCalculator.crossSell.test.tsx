// Progressive cross-sell disclosure on the two itemised service pages.
//
// The Carpet page leads with carpets and offers upholstery; the Sofa page does
// the exact reverse. Both use the same counts and the same computeCarpetPrice
// call as the always-open homepage calculator, so these tests pin the two
// things that could actually hurt a customer:
//
//   1. a hidden product must never sit in the price, and
//   2. the homepage/leaflet calculator must keep showing both groups outright.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';
import { CARPET_ITEM_PRICES_P } from '../data/pricing';

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

function renderCalc(
  mode: 'carpet' | 'upholstery' | 'all-services',
  onBook?: (sel: unknown) => void,
) {
  return render(
    <MemoryRouter>
      <BookingProvider>
        <QuoteCalculator mode={mode} onBook={onBook} />
      </BookingProvider>
    </MemoryRouter>,
  );
}

const user = () => userEvent.setup();
const yesBtn = () => screen.getByRole('button', { name: 'Yes' });
const noBtn  = () => screen.getByRole('button', { name: 'No' });

async function add(u: ReturnType<typeof userEvent.setup>, label: string, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await u.click(screen.getByRole('button', { name: `Increase ${label} quantity` }));
  }
}

const CARPET_Q = 'Would you also like upholstery cleaning?';
const SOFA_Q   = 'Would you also like carpet cleaning?';

// ── Carpet page → upholstery ────────────────────────────────────────────────

describe('Carpet page — optional upholstery disclosure', () => {
  it('hides the upholstery controls until the customer asks for them', () => {
    renderCalc('carpet');

    // The offer itself is always visible; only its controls are collapsed.
    expect(screen.getByText(CARPET_Q)).toBeInTheDocument();
    expect(screen.getByText('Optional — add a sofa, armchair or mattress to the same visit.'))
      .toBeInTheDocument();

    expect(screen.queryByText('3-seater sofa')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Increase 3-seater sofa quantity' }))
      .not.toBeInTheDocument();

    // Carpets — the service the visitor actually came for — stay visible.
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
  });

  it('starts on No, and marks Yes as collapsed', () => {
    renderCalc('carpet');
    expect(noBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(yesBtn()).toHaveAttribute('aria-pressed', 'false');
    expect(yesBtn()).toHaveAttribute('aria-expanded', 'false');
  });

  it('reveals the real upholstery controls when the customer says Yes', async () => {
    const u = user();
    renderCalc('carpet');
    await u.click(yesBtn());

    expect(yesBtn()).toHaveAttribute('aria-expanded', 'true');
    expect(yesBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(noBtn()).toHaveAttribute('aria-pressed', 'false');

    for (const label of ['Armchair', '2-seater sofa', '3-seater sofa', 'Corner / L-shaped sofa']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('names a panel that actually exists, and labels it with the question', async () => {
    const u = user();
    renderCalc('carpet');
    await u.click(yesBtn());

    const panelId = yesBtn().getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();
    // The revealed controls really are inside the panel the button points at.
    expect(within(panel!).getByText('3-seater sofa')).toBeInTheDocument();

    const labelId = panel!.getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelId)).toHaveTextContent(CARPET_Q);
  });

  it('clears upholstery quantities when the customer goes back to No', async () => {
    const u = user();
    renderCalc('carpet');

    // Two carpet rooms, so the carpet-only total sits clear of the £85
    // minimum booking and this test is about the cross-sell, not the floor.
    await add(u, 'Bedroom');                   // £50
    await add(u, 'Living / dining room');      // £70 → £120
    await u.click(yesBtn());
    await add(u, '3-seater sofa');             // £95 → £215
    expect(screen.getAllByText('£215').length).toBeGreaterThan(0);

    await u.click(noBtn());

    // Price drops back to carpets only — the hidden sofa is not still in it.
    expect(screen.getAllByText('£120').length).toBeGreaterThan(0);
    expect(screen.queryByText('£215')).not.toBeInTheDocument();
  });

  it('does not resurrect a cleared sofa when the panel is reopened', async () => {
    const u = user();
    renderCalc('carpet');

    await u.click(yesBtn());
    await add(u, '3-seater sofa', 2);
    await u.click(noBtn());
    await u.click(yesBtn());

    // Counter shows 0 again, not the 2 selected before saying No.
    const row = screen.getByText('3-seater sofa').closest('div.flex.items-start') as HTMLElement;
    expect(within(row).getByText('0')).toBeInTheDocument();
  });

  it('never books a cleared upholstery item', async () => {
    const onBook = vi.fn();
    const u = user();
    renderCalc('carpet', onBook);

    await add(u, 'Bedroom');
    await add(u, 'Living / dining room');       // £50 + £70 = £120
    await u.click(yesBtn());
    await add(u, 'Corner / L-shaped sofa');     // + £130
    await u.click(noBtn());                     // …then changes their mind

    await u.click(screen.getAllByRole('button', { name: /Book online/i })[0]);

    const sel = onBook.mock.calls[0][0] as {
      price: number;
      quoteConfig?: { carpetCounts?: Record<string, number> };
    };
    expect(sel.price).toBe(120);
    expect(sel.quoteConfig?.carpetCounts?.sofa_corner).toBe(0);
    expect(sel.quoteConfig?.carpetCounts?.bedroom).toBe(1);
  });
});

// ── Sofa page → carpets (reciprocal) ────────────────────────────────────────

describe('Sofa page — optional carpet disclosure', () => {
  it('hides the carpet controls until the customer asks for them', () => {
    renderCalc('upholstery');

    expect(screen.getByText(SOFA_Q)).toBeInTheDocument();
    expect(screen.getByText('Optional — add rooms, stairs or rugs to the same visit.'))
      .toBeInTheDocument();

    expect(screen.queryByText('Bedroom')).not.toBeInTheDocument();
    expect(screen.queryByText('Stairs')).not.toBeInTheDocument();

    // Sofas stay visible.
    expect(screen.getByText('3-seater sofa')).toBeInTheDocument();
  });

  it('reveals the real carpet controls when the customer says Yes', async () => {
    const u = user();
    renderCalc('upholstery');
    await u.click(yesBtn());

    for (const label of ['Bedroom', 'Living / dining room', 'Hallway', 'Stairs']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('prices a combined sofa + carpet basket from the central catalogue', async () => {
    const u = user();
    renderCalc('upholstery');

    await add(u, '3-seater sofa');       // £95
    await u.click(yesBtn());
    await add(u, 'Bedroom');             // £50 → £145

    const expected = (CARPET_ITEM_PRICES_P.sofa_3 + CARPET_ITEM_PRICES_P.bedroom) / 100;
    expect(expected).toBe(145);
    expect(screen.getAllByText(`£${expected}`).length).toBeGreaterThan(0);
  });

  it('clears carpet quantities when the customer goes back to No', async () => {
    const u = user();
    renderCalc('upholstery');

    await add(u, '3-seater sofa');       // £95
    await u.click(yesBtn());
    await add(u, 'Bedroom');             // £50 → £145
    expect(screen.getAllByText('£145').length).toBeGreaterThan(0);

    await u.click(noBtn());
    expect(screen.getAllByText('£95').length).toBeGreaterThan(0);
    expect(screen.queryByText('£145')).not.toBeInTheDocument();
  });

  it('never books a cleared carpet item', async () => {
    const onBook = vi.fn();
    const u = user();
    renderCalc('upholstery', onBook);

    await add(u, '3-seater sofa');       // £95
    await u.click(yesBtn());
    await add(u, 'Bedroom', 3);          // + £150
    await u.click(noBtn());

    await u.click(screen.getAllByRole('button', { name: /Book online/i })[0]);

    const sel = onBook.mock.calls[0][0] as {
      price: number;
      quoteConfig?: { carpetCounts?: Record<string, number> };
    };
    expect(sel.price).toBe(95);
    expect(sel.quoteConfig?.carpetCounts?.bedroom).toBe(0);
    expect(sel.quoteConfig?.carpetCounts?.sofa_3).toBe(1);
  });
});

// ── The homepage / leaflet calculator must be untouched ─────────────────────

describe('all-services mode is unaffected by the disclosure', () => {
  it('still shows both groups outright, with no Yes/No gate', () => {
    renderCalc('all-services');

    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText('3-seater sofa')).toBeInTheDocument();

    expect(screen.queryByText(CARPET_Q)).not.toBeInTheDocument();
    expect(screen.queryByText(SOFA_Q)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument();
  });
});

// ── Returning from Booking ──────────────────────────────────────────────────

describe('restore from a booking in progress', () => {
  it('reopens the panel when the restored quote already contains cross-sell items', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      quoteConfig: {
        service: 'deep',
        deepService: 'carpet_upholstery',
        carpetCounts: { living_room: 1, sofa_3: 1 },
        carpetCondition: 'normal',
      },
    }));

    renderCalc('carpet');

    // A collapsed panel here would leave the customer paying for a sofa they
    // cannot see, so the disclosure has to match what is in the price.
    expect(yesBtn()).toHaveAttribute('aria-expanded', 'true');
    // Appears twice once restored: the item row and the summary line.
    expect(screen.getAllByText('3-seater sofa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£165').length).toBeGreaterThan(0);

    sessionStorage.clear();
  });

  it('stays collapsed when the restored quote is carpet-only', () => {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify({
      quoteConfig: {
        service: 'deep',
        deepService: 'carpet_upholstery',
        carpetCounts: { living_room: 1, bedroom: 1 },
        carpetCondition: 'normal',
      },
    }));

    renderCalc('carpet');

    expect(yesBtn()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('3-seater sofa')).not.toBeInTheDocument();
    expect(screen.getAllByText('£120').length).toBeGreaterThan(0);

    sessionStorage.clear();
  });
});
