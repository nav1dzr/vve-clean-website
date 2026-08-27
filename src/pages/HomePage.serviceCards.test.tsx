// The homepage leads with service cards, followed by a quote section that is
// always present. Before a service is chosen it shows an introductory panel
// (eyebrow, heading, step indicator, dropdown, benefits); choosing a service —
// from a card or from that dropdown — replaces it with the detailed calculator.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  sessionStorage.clear();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CookieConsentProvider>
        <HomePage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

/**
 * The card grid, scoped by id. Several of these service names also appear in
 * the existing Services section further down the page and in the nav, so an
 * unscoped query matches more than one node.
 */
function cardGrid() {
  const el = document.getElementById('choose-service');
  expect(el).not.toBeNull();
  return within(el as HTMLElement);
}

function quoteSection() {
  const el = document.getElementById('quote');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

/** Clicks the "Get quote" button belonging to a named service card. */
async function chooseCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  const card = cardGrid().getByText(title).closest('article');
  expect(card).not.toBeNull();
  await user.click(within(card as HTMLElement).getByRole('button', { name: /Get quote/i }));
}

/**
 * Copy unique to each branch of the detailed calculator.
 *
 * after_builders does NOT show a property-size selector: the scope varies too
 * much to price from size alone, so the branch renders a photo-quote callout
 * instead (`isAfterBuilders` in QuoteCalculator.tsx). This marker previously
 * expected /Property Size/i and had been failing on `main` before this branch
 * existed — the assertion was wrong, not the component.
 */
const DETAIL_MARKER: Record<string, RegExp> = {
  carpet: /Living \/ dining room/i,
  upholstery: /Armchair/i,
  move_in: /Property Size/i,
  after_builders: /After Builders Clean/i,
};

describe('HomePage — fresh visit', () => {
  it('renders exactly one #quote section, always present', () => {
    renderHome();
    expect(document.querySelectorAll('#quote')).toHaveLength(1);
  });

  it('shows the introductory quote panel with its full copy', () => {
    renderHome();
    const q = within(quoteSection());

    expect(q.getByText('Instant quote')).toBeInTheDocument();
    expect(q.getByRole('heading', { name: 'Get an instant quote' })).toBeInTheDocument();
    expect(q.getByText('Start by choosing the service you need.')).toBeInTheDocument();

    // Three-step indicator.
    for (const [num, label] of [['1', 'Service'], ['2', 'Details'], ['3', 'Quote']]) {
      expect(q.getByText(num)).toBeInTheDocument();
      expect(q.getByText(label)).toBeInTheDocument();
    }

    // Selector and its placeholder.
    expect(q.getByLabelText('Select a service')).toBeInTheDocument();
    expect(q.getByRole('option', { name: 'Choose what you would like cleaned' })).toBeInTheDocument();

    expect(q.getByText(/No hidden fees · Live price where available · £30 booking deposit/)).toBeInTheDocument();

    // Benefits panel.
    expect(q.getByRole('heading', { name: 'Why book with VVE Clean?' })).toBeInTheDocument();
    for (const benefit of [
      'Transparent pricing with no hidden fees',
      '£30 deposit handled securely by Stripe',
      'Professional equipment and direct support',
      '£5m public liability insurance',
      // Was "Rated 5.0 by genuine Google reviewers". The numeric rating was
      // never substantiated anywhere in the project and could not be verified
      // against the live profile, so the claim is now only that the reviews are
      // real and public. See src/data/googleRating.ts.
      'Genuine reviews on our public Google profile',
    ]) {
      expect(q.getByText(benefit)).toBeInTheDocument();
    }
  });

  it('does not yet show the detailed calculator fields', () => {
    renderHome();
    const q = within(quoteSection());

    expect(q.queryByText('Service Type')).not.toBeInTheDocument();
    expect(q.queryByText('Property Size')).not.toBeInTheDocument();
    expect(q.queryByText('Condition')).not.toBeInTheDocument();
    expect(q.queryByText(/Request booking/i)).not.toBeInTheDocument();
  });

  it('still shows all five service cards above the quote', () => {
    renderHome();
    const grid = cardGrid();
    for (const title of ['Carpet Cleaning', 'Sofa & Upholstery', 'End of Tenancy', 'Deep Cleaning', 'After Builders']) {
      expect(grid.getByText(title)).toBeInTheDocument();
    }
    expect(grid.getAllByRole('button', { name: /Get quote/i })).toHaveLength(5);

    // Cards come first in the document, the quote below them.
    const cards = document.getElementById('choose-service') as HTMLElement;
    expect(cards.compareDocumentPosition(quoteSection()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('HomePage — choosing from the dropdown', () => {
  const cases: Array<{ label: string; service: string }> = [
    { label: 'Carpet cleaning', service: 'carpet' },
    { label: 'Sofa or upholstery cleaning', service: 'upholstery' },
    // 'End of tenancy cleaning' is deliberately absent: it now opens the shared
    // premium quote instead of this calculator. See HomePage.premiumEot.test.tsx.
    { label: 'Move-in deep cleaning', service: 'move_in' },
    { label: 'After-builders cleaning', service: 'after_builders' },
  ];

  for (const { label, service } of cases) {
    it(`opens the ${service} calculator`, async () => {
      const user = userEvent.setup();
      renderHome();

      await user.selectOptions(within(quoteSection()).getByLabelText('Select a service'), service);

      await waitFor(() => {
        expect(within(quoteSection()).queryByText('Service Type')).toBeInTheDocument();
      });
      expect(within(quoteSection()).getAllByText(DETAIL_MARKER[service]).length).toBeGreaterThan(0);
      // The introductory panel is gone, replaced rather than stacked.
      expect(within(quoteSection()).queryByLabelText('Select a service')).not.toBeInTheDocument();
      void label;
    });
  }
});

describe('HomePage — choosing from a service card', () => {
  const cases: Array<{ card: string; service: string }> = [
    { card: 'Carpet Cleaning', service: 'carpet' },
    { card: 'Sofa & Upholstery', service: 'upholstery' },
    // 'End of Tenancy' is deliberately absent — see the note above.
    { card: 'Deep Cleaning', service: 'move_in' },
    { card: 'After Builders', service: 'after_builders' },
  ];

  for (const { card, service } of cases) {
    it(`${card} opens the ${service} calculator`, async () => {
      const user = userEvent.setup();
      renderHome();
      await chooseCard(user, card);

      await waitFor(() => {
        expect(within(quoteSection()).queryByText('Service Type')).toBeInTheDocument();
      });
      expect(within(quoteSection()).getAllByText(DETAIL_MARKER[service]).length).toBeGreaterThan(0);
    });
  }

  it('scrolls to the quote section when the choice came from a card', async () => {
    const user = userEvent.setup();
    renderHome();
    await chooseCard(user, 'Deep Cleaning');

    await waitFor(() => {
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it('keeps the light homepage surface, not the dark service-page gradient', async () => {
    const user = userEvent.setup();
    renderHome();
    await chooseCard(user, 'Carpet Cleaning');

    await waitFor(() => {
      expect(within(quoteSection()).queryByText('Service Type')).toBeInTheDocument();
    });
    expect(quoteSection().className).toContain('bg-surface');
    expect(quoteSection().className).not.toContain('from-navy-950');
  });
});

describe('HomePage — returning from the booking page', () => {
  it('reopens the detailed quote immediately, skipping the introductory panel', async () => {
    // Exactly what BookingPage's "Back to quote" leaves behind.
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem(
      'vve_booking',
      JSON.stringify({
        serviceName: 'Carpet Cleaning',
        price: 299,
        quoteConfig: { service: 'deep', deepService: 'carpet_upholstery', carpetCounts: { bedroom: 1 } },
      }),
    );

    renderHome();

    // No card click and no dropdown: the restored quote alone opens it.
    await waitFor(() => {
      expect(within(quoteSection()).queryByText('Service Type')).toBeInTheDocument();
    });
    expect(within(quoteSection()).queryByLabelText('Select a service')).not.toBeInTheDocument();
    expect(within(quoteSection()).getAllByText(/Bedroom/i).length).toBeGreaterThan(0);
  });
});

describe('HomePage — layout safety', () => {
  // Guards the one thing a narrow viewport punishes: a fixed width wider than
  // the screen. Checked on the real markup rather than by eye.
  it('declares no fixed pixel width that could overflow a 360px viewport', () => {
    renderHome();
    const offenders: string[] = [];
    for (const el of Array.from(quoteSection().querySelectorAll<HTMLElement>('*'))) {
      const m = el.className?.toString().match(/(?:^|\s)w-\[(\d+)px\]/);
      if (m && Number(m[1]) > 360) offenders.push(el.className);
    }
    expect(offenders).toEqual([]);
  });

  it('stacks the panel on mobile and splits it in two on large screens', () => {
    renderHome();
    // The grid is single-column by default and only becomes two columns at lg,
    // which is what puts the benefits panel below the selector on a phone.
    const grid = quoteSection().querySelector('.grid');
    expect(grid).not.toBeNull();
    expect((grid as HTMLElement).className).toContain('lg:grid-cols-');
    expect((grid as HTMLElement).className).not.toMatch(/(?:^|\s)grid-cols-2/);
  });
});
