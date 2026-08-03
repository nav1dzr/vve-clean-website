// End of Tenancy on the homepage must be the *same* premium quote the service
// page uses — the real EotQuotePremium, not a homepage lookalike. These tests
// drive both pages through identical selections and compare the totals, so the
// two cannot drift apart.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import EndOfTenancyPage from './EndOfTenancyPage';
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
  vi.mocked(window.HTMLElement.prototype.scrollIntoView).mockClear();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CookieConsentProvider><HomePage /></CookieConsentProvider>
    </MemoryRouter>,
  );
}

function renderEotPage() {
  return render(
    <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
      <CookieConsentProvider><EndOfTenancyPage /></CookieConsentProvider>
    </MemoryRouter>,
  );
}

function quote() {
  const el = document.getElementById('quote');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}
const q = () => within(quote());

/**
 * The premium quote is the only thing on either page with a stepped
 * progressbar, so this identifies it without depending on which step is open.
 */
function premiumIsOpen() {
  return quote().querySelector('[role="progressbar"]') !== null;
}

/** Clicks "Get quote" on a named homepage service card. */
async function chooseCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  const grid = document.getElementById('choose-service') as HTMLElement;
  const card = within(grid).getByText(title).closest('article');
  await user.click(within(card as HTMLElement).getByRole('button', { name: /Get quote/i }));
}

/**
 * Whether anything scrolled the quote section into view. Checked against the
 * #quote element specifically rather than a bare call count, because other
 * parts of the page legitimately scroll their own nodes.
 */
function scrolledToQuote() {
  const spy = window.HTMLElement.prototype.scrollIntoView as unknown as {
    mock: { instances: unknown[] };
  };
  return spy.mock.instances.some((el) => (el as HTMLElement)?.id === 'quote');
}

async function openHomepageEot(user: ReturnType<typeof userEvent.setup>) {
  await chooseCard(user, 'End of Tenancy');
  await waitFor(() => expect(premiumIsOpen()).toBe(true));
}

interface Scenario {
  size: string;
  house?: boolean;
  bathrooms?: number;
  wcs?: number;
  upgrades?: string[];
  scopeCredits?: string[];
}

/**
 * Drives whichever premium quote is mounted through one scenario and returns
 * every money figure shown on the Review step. Identical steps for both pages —
 * that is the point of the test.
 */
const STEP_HEADING = [
  'Tell us about your property',
  'Bathrooms and WCs',
  'Add optional upgrades',
  'Review your quote',
  'Secure your date',
] as const;

/**
 * The primary action is rendered twice — once in the card, once in the mobile
 * bar / desktop summary — with visibility split by breakpoint. Both exist in
 * jsdom, so click the first.
 */
async function clickPrimary(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(q().getAllByRole('button', { name })[0]);
}

async function priceScenario(user: ReturnType<typeof userEvent.setup>, s: Scenario) {
  // Step 1 — Property.
  if (s.house) await user.click(q().getByRole('radio', { name: /^House —/ }));
  await user.click(q().getByRole('radio', { name: s.size }));
  await clickPrimary(user, 'Continue');

  // Step 2 — Bathrooms.
  await waitFor(() => expect(q().getByRole('heading', { name: STEP_HEADING[1] })).toBeInTheDocument());
  for (let i = 1; i < (s.bathrooms ?? 1); i += 1) {
    await user.click(q().getByRole('button', { name: 'Increase Full bathrooms' }));
  }
  for (let i = 0; i < (s.wcs ?? 0); i += 1) {
    await user.click(q().getByRole('button', { name: /^Increase Additional WC/ }));
  }
  await clickPrimary(user, 'Continue');

  // Step 3 — Upgrades. The button reads "Review quote" on this step.
  await waitFor(() => expect(q().getByRole('heading', { name: STEP_HEADING[2] })).toBeInTheDocument());
  for (const name of s.upgrades ?? []) {
    await user.click(q().getByRole('button', { name: `Add ${name}` }));
  }
  if (s.scopeCredits?.length) {
    // Scope credits live inside a collapsed disclosure.
    await user.click(q().getByRole('button', { name: 'Already cleaned something yourself?' }));
    for (const name of s.scopeCredits) {
      await user.click(q().getByRole('button', { name: `Add ${name}` }));
    }
  }
  await clickPrimary(user, 'Review quote');

  // Step 4 — Review carries the full breakdown.
  await waitFor(() => expect(q().getByRole('heading', { name: STEP_HEADING[3] })).toBeInTheDocument());

  // The heading commits before the breakdown rows have all rendered, so reading
  // immediately after it caught a half-populated list whenever the suite ran
  // under load — producing two strings that looked identical in the diff but
  // differed past the truncation.
  const readMoney = () => q().getAllByText(/£[\d,]+/)
    .map((n) => n.textContent?.trim())
    .join('|');

  // "Two identical reads means React is done" turned out to be too weak. Under
  // load the whole panel could sit on a stale headline total for several 50ms
  // polls and only update after the read returned, so both reads agreed on a
  // value that was already wrong. Those runs failed as a price mismatch, not a
  // timeout, and the mismatched snapshot was internally contradictory: it
  // showed "Your total: £299" alongside a breakdown of "£30 deposit today ·
  // £294 after your clean", which is £324.
  //
  // So settle on that invariant instead of on stillness. The headline total
  // always equals the £30 deposit plus the balance quoted beside it; while a
  // commit is outstanding it does not. This cannot mask a genuine pricing bug —
  // an internally consistent but wrong total still fails the comparison the
  // test actually makes.
  const isConsistent = (money: string) => {
    const total = money.match(/Your total: £([\d,]+)/);
    const balance = money.match(/£([\d,]+) after your clean/);
    if (!total || !balance) return true; // Scenario without the deposit split.
    const n = (s: string) => Number(s.replace(/,/g, ''));
    return n(total[1]) === n(balance[1]) + 30;
  };

  let previous: string | null = null;
  await waitFor(() => {
    const current = readMoney();
    expect(current.length).toBeGreaterThan(0);
    expect(isConsistent(current)).toBe(true);
    // Still require stillness as well: consistency alone could be satisfied by
    // a breakdown that has not started updating at all.
    const settled = current === previous;
    previous = current;
    expect(settled).toBe(true);
  }, { timeout: 8000, interval: 50 });

  return readMoney();
}

describe('HomePage — fresh visit still shows the introductory panel', () => {
  it('shows the intro panel, exactly one #quote, and no detailed fields', () => {
    renderHome();

    expect(document.querySelectorAll('#quote')).toHaveLength(1);
    expect(q().getByText('Instant quote')).toBeInTheDocument();
    expect(q().getByRole('heading', { name: 'Get an instant quote' })).toBeInTheDocument();
    expect(q().getByText('Start by choosing the service you need.')).toBeInTheDocument();
    expect(q().getByLabelText('Select a service')).toBeInTheDocument();
    expect(q().getByRole('heading', { name: 'Why book with VVE Clean?' })).toBeInTheDocument();

    // Neither the legacy calculator nor the premium quote is showing yet.
    expect(q().queryByText('Service Type')).not.toBeInTheDocument();
    expect(premiumIsOpen()).toBe(false);
  });
});

describe('HomePage — End of Tenancy opens the premium quote', () => {
  it('opens the five-step journey from the service card and scrolls to #quote', async () => {
    const user = userEvent.setup();
    renderHome();
    await openHomepageEot(user);

    expect(q().queryByText('Service Type')).not.toBeInTheDocument();
    expect(q().getByRole('heading', { name: STEP_HEADING[0] })).toBeInTheDocument();
    expect(q().getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 1 of 5: Property');
    await waitFor(() => expect(scrolledToQuote()).toBe(true));
    expect(document.querySelectorAll('#quote')).toHaveLength(1);
  });

  it('opens from the dropdown without forcing a scroll', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.selectOptions(q().getByLabelText('Select a service'), 'end_of_tenancy');

    await waitFor(() => expect(premiumIsOpen()).toBe(true));
    // Comfortably past the card path's 50ms deferred scroll.
    await new Promise((r) => setTimeout(r, 200));
    expect(scrolledToQuote()).toBe(false);
    expect(document.querySelectorAll('#quote')).toHaveLength(1);
  });

  it('walks all five steps in order', async () => {
    const user = userEvent.setup();
    renderHome();
    await openHomepageEot(user);

    await user.click(q().getByRole('radio', { name: '2 bed' }));
    for (const [i, action] of ['Continue', 'Continue', 'Review quote', 'Continue'].entries()) {
      await clickPrimary(user, action);
      await waitFor(() =>
        expect(q().getByRole('heading', { name: STEP_HEADING[i + 1] })).toBeInTheDocument());
    }
  });

  it('leaves the other four services on their existing calculator', async () => {
    for (const card of ['Carpet Cleaning', 'Sofa & Upholstery', 'Deep Cleaning', 'After Builders']) {
      const user = userEvent.setup();
      const view = renderHome();
      await chooseCard(user, card);

      await waitFor(() => expect(q().queryByText('Service Type')).toBeInTheDocument());
      expect(premiumIsOpen()).toBe(false);
      expect(document.querySelectorAll('#quote')).toHaveLength(1);
      view.unmount();
    }
  });
});

describe('Homepage and End of Tenancy page price identically', () => {
  const scenarios: Array<{ name: string; opts: Scenario }> = [
    { name: 'a 2-bed flat', opts: { size: '2 bed' } },
    { name: 'a 3-bed house (house adjustment)', opts: { size: '3 bed', house: true } },
    { name: 'additional bathrooms', opts: { size: '2 bed', bathrooms: 3 } },
    { name: 'an additional WC', opts: { size: '1 bed', wcs: 1 } },
    {
      name: 'upgrades',
      opts: { size: '2 bed', upgrades: ['Carpets — whole home', '3-seater sofa'] },
    },
    {
      name: 'scope credits',
      opts: { size: '3 bed', scopeCredits: ['Oven is already inspection-ready'] },
    },
    {
      name: 'everything at once',
      opts: {
        size: '4 bed',
        house: true,
        bathrooms: 2,
        wcs: 1,
        upgrades: ['Carpets — whole home'],
        scopeCredits: ['Oven is already inspection-ready', 'Internal windows are already cleaned'],
      },
    },
  ];

  for (const { name, opts } of scenarios) {
    it(`matches for ${name}`, async () => {
      const userA = userEvent.setup();
      const home = renderHome();
      await openHomepageEot(userA);
      const homeTotal = await priceScenario(userA, opts);
      home.unmount();

      const userB = userEvent.setup();
      const eot = renderEotPage();
      await waitFor(() => expect(premiumIsOpen()).toBe(true));
      const pageTotal = await priceScenario(userB, opts);
      eot.unmount();

      expect(homeTotal).toBe(pageTotal);
      expect(homeTotal).toMatch(/£\d/);
    },
    // Each scenario renders two whole pages and drives both through the full
    // five-step wizard. Run on its own that is ~1-2s per scenario, but these
    // execute in parallel with the rest of the suite and get CPU-starved by it:
    // the same scenario has been measured at 1.2s in isolation and >20s under
    // full load. Every failure has been a timeout, never a price mismatch, so
    // the ceiling is deliberately generous — it exists to bound a genuine hang,
    // not to describe how long the work should take.
    60_000);
  }
});

describe('Five or more bedrooms stays a tailored quote', () => {
  it('invents no fixed price on the homepage', async () => {
    const user = userEvent.setup();
    renderHome();
    await openHomepageEot(user);

    await user.click(q().getByRole('radio', { name: /^5\+ bed/ }));

    // No bookable action and no invented figure: the primary action becomes a
    // request for a tailored quote, and nothing anywhere in the section shows a
    // price — not even a £0 standing in for one.
    expect(q().queryByRole('button', { name: /Secure my date/i })).not.toBeInTheDocument();
    expect(q().getAllByRole('link', { name: /Request my tailored quote/ }).length).toBeGreaterThan(0);
    // Bare money figures only — totals render as their own node ("£449").
    // The static "£30 deposit" reassurance line is prose and stays.
    expect(q().queryAllByText(/^£[\d,]+$/)).toHaveLength(0);
  });
});

describe('HomePage — returning from booking', () => {
  const storedEot = {
    serviceName: 'End of Tenancy Cleaning',
    price: 449,
    quoteConfig: {
      service: 'deep',
      deepService: 'end_of_tenancy',
      deepSize: 'bed3',
      deepBaths: 2,
      addOnCounts: { carpet_bundle: 1 },
      propertyType: 'house',
      eotScopeExclusions: [],
    },
  };

  function seedRestore(payload: unknown = storedEot) {
    sessionStorage.setItem('vve_restore_quote', '1');
    sessionStorage.setItem('vve_booking', JSON.stringify(payload));
  }

  it('reopens the premium journey, not the legacy calculator', async () => {
    seedRestore();
    renderHome();

    await waitFor(() => expect(premiumIsOpen()).toBe(true));
    expect(q().queryByText('Service Type')).not.toBeInTheDocument();
    expect(q().queryByLabelText('Select a service')).not.toBeInTheDocument();
    expect(document.querySelectorAll('#quote')).toHaveLength(1);
  });

  it('lets an explicit service-card choice replace a restored EOT quote', async () => {
    seedRestore();
    const user = userEvent.setup();
    renderHome();
    await waitFor(() => expect(premiumIsOpen()).toBe(true));

    await chooseCard(user, 'Carpet Cleaning');

    await waitFor(() => expect(q().queryByText('Service Type')).toBeInTheDocument());
    expect(premiumIsOpen()).toBe(false);
    expect(document.querySelectorAll('#quote')).toHaveLength(1);
  });

  it('restores the previous property type and size', async () => {
    seedRestore();
    renderHome();
    await waitFor(() => expect(premiumIsOpen()).toBe(true));

    expect(q().getByRole('radio', { name: /^House —/ })).toHaveAttribute('aria-checked', 'true');
    expect(q().getByRole('radio', { name: '3 bed' })).toHaveAttribute('aria-checked', 'true');
  });

  it('consumes the restore flag so a later visit starts fresh', async () => {
    seedRestore();
    const view = renderHome();
    await waitFor(() => expect(premiumIsOpen()).toBe(true));
    expect(sessionStorage.getItem('vve_restore_quote')).toBeNull();
    view.unmount();

    renderHome();
    expect(q().getByRole('heading', { name: 'Get an instant quote' })).toBeInTheDocument();
  });

  it('leaves a non-EOT restore to the existing calculator', async () => {
    seedRestore({
      serviceName: 'Carpet Cleaning',
      price: 120,
      quoteConfig: { service: 'deep', deepService: 'carpet_upholstery', carpetCounts: { bedroom: 1 } },
    });

    renderHome();

    await waitFor(() => expect(q().queryByText('Service Type')).toBeInTheDocument());
    expect(premiumIsOpen()).toBe(false);
  });

  it('degrades to a blank premium quote if the stored payload is unusable', async () => {
    seedRestore({
      serviceName: 'End of Tenancy Cleaning',
      price: 0,
      quoteConfig: { service: 'deep', deepService: 'end_of_tenancy', deepSize: 'nonsense', deepBaths: -4 },
    });

    renderHome();

    await waitFor(() => expect(premiumIsOpen()).toBe(true));
    // Nothing invalid was applied: no size selected, so no price is shown yet.
    for (const size of ['Studio', '1 bed', '2 bed', '3 bed', '4 bed']) {
      expect(q().getByRole('radio', { name: size })).toHaveAttribute('aria-checked', 'false');
    }
  });
});
