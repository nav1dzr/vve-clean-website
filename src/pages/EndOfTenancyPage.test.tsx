// Business guarantees for the End of Tenancy page, asserted through the
// premium guided quote UI.
//
// Same commitments the original calculator-driven tests pinned — the £35 house
// adjustment, the documented £584 four-bed-house example, the 5+ tailored
// route and the capped scope credit. Only the interactions changed.
// Pure-arithmetic coverage lives in src/lib/eotPricing.test.ts.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EndOfTenancyPage from './EndOfTenancyPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { BookingProvider } from '../context/BookingContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
      <CookieConsentProvider>
        <BookingProvider>
          <EndOfTenancyPage />
        </BookingProvider>
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

/**
 * Scopes queries to the quote. The page also carries a static pricing table
 * that repeats phrases like "House / maisonette adjustment", so page-wide
 * queries would match copy the customer never sees inside the quote.
 */
function quote() {
  const el = document.getElementById('quote');
  if (!el) throw new Error('quote section not found');
  return within(el);
}

type User = ReturnType<typeof userEvent.setup>;

const pick = (user: User, group: string, name: RegExp) =>
  user.click(within(quote().getByRole('radiogroup', { name: group })).getByRole('radio', { name }));

const advance = (user: User) =>
  user.click(quote().getAllByRole('button', { name: /Continue|Review quote/i })[0]);

/** Property → Bathrooms → Upgrades → Review. */
async function goToReview(user: User, size: RegExp = /^2 bed$/) {
  await pick(user, 'Property size', size);
  await advance(user); // → Bathrooms
  await advance(user); // → Upgrades
  await advance(user); // → Review
}

describe('EndOfTenancyPage — premium guided quote', () => {
  it('presents the approved proposition and an EOT-only quote', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Complete End of Tenancy Cleaning London/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Build your complete quote/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
  });

  it('starts on step 1 of 5 with the official wordmark and a secure-quote badge', () => {
    renderPage();
    expect(quote().getByText(/Step 1 of 5/i)).toBeInTheDocument();
    expect(quote().getAllByText('VVE Clean').length).toBeGreaterThan(0);
    expect(quote().getByText('Secure quote')).toBeInTheDocument();
  });

  it('exposes property choices as an accessible radiogroup', () => {
    renderPage();
    const sizes = quote().getByRole('radiogroup', { name: 'Property size' });
    expect(within(sizes).getAllByRole('radio')).toHaveLength(6);
    const types = quote().getByRole('radiogroup', { name: 'Property type' });
    expect(within(types).getByRole('radio', { name: /^Flat/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows a price immediately after property type and size, still on step 1', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^2 bed$/);
    expect(quote().getAllByText('£369').length).toBeGreaterThan(0);
    expect(quote().getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it('never shows the +£35 house adjustment beside the House option', async () => {
    const user = userEvent.setup();
    renderPage();
    const types = quote().getByRole('radiogroup', { name: 'Property type' });
    expect(within(types).getByRole('radio', { name: /^House/ })).toHaveTextContent(
      'House or maisonette',
    );
    expect(within(types).queryByText(/£35/)).not.toBeInTheDocument();
    // ...but it still moves the live total.
    await pick(user, 'Property size', /^4 bed$/);
    expect(quote().getAllByText('£549').length).toBeGreaterThan(0);
    await pick(user, 'Property type', /^House/);
    expect(quote().getAllByText('£584').length).toBeGreaterThan(0);
  });

  it('does not show per-item amounts beside the bathroom or WC steppers', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^2 bed$/);
    await advance(user);
    expect(quote().queryByText(/\+£50 each/i)).not.toBeInTheDocument();
    expect(quote().queryByText(/\+£25 each/i)).not.toBeInTheDocument();
    // The total still updates.
    await user.click(quote().getByRole('button', { name: 'Increase Full bathrooms' }));
    expect(quote().getAllByText('£419').length).toBeGreaterThan(0);
    await user.click(quote().getByRole('button', { name: 'Increase Additional WC' }));
    expect(quote().getAllByText('£444').length).toBeGreaterThan(0);
  });

  it('itemises every hidden adjustment on the review step', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^4 bed$/);
    await pick(user, 'Property type', /^House/);
    await advance(user);
    await user.click(quote().getByRole('button', { name: 'Increase Full bathrooms' }));
    await advance(user);
    await advance(user);
    expect(quote().getByText(/Price breakdown/i)).toBeInTheDocument();
    expect(quote().getByText(/House \/ maisonette adjustment/i)).toBeInTheDocument();
    expect(quote().getByText(/Additional full bathroom/i)).toBeInTheDocument();
    expect(quote().getAllByText('£634').length).toBeGreaterThan(0); // 549 + 35 + 50
    expect(quote().getAllByText(/£30 deposit today/i).length).toBeGreaterThan(0);
    expect(quote().getAllByText(/Balance after your clean/i).length).toBeGreaterThan(0);
  });

  it('never asks for parking or the Congestion Charge in the quote', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToReview(user);
    expect(quote().queryByRole('group', { name: /parking/i })).not.toBeInTheDocument();
    expect(quote().queryByRole('group', { name: /Congestion/i })).not.toBeInTheDocument();
    // It does disclose that they are confirmed later, so the total stays honest.
    expect(
      quote().getByText(/Parking and the Congestion Charge are confirmed at booking/i),
    ).toBeInTheDocument();
  });

  it('routes 5+ bedroom properties to a tailored quote with no fixed total', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^5\+ bed/);
    expect(quote().getAllByText(/Tailored quote/i).length).toBeGreaterThan(0);
    expect(
      quote().getAllByRole('link', { name: /Request my tailored quote/i })[0],
    ).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(quote().queryByRole('button', { name: /Secure my date/i })).not.toBeInTheDocument();
  });

  it('caps the scope credit at £30', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^4 bed$/);
    await advance(user); // → Bathrooms
    await advance(user); // → Upgrades
    await user.click(quote().getByRole('button', { name: /Already cleaned something yourself/i }));
    for (const label of [
      /Oven is already inspection-ready/i,
      /Fridge\/freezer is empty and inspection-ready/i,
      /Empty cupboards are already inspection-ready/i,
      /Internal windows are already cleaned/i,
    ]) {
      await user.click(quote().getByRole('button', { name: new RegExp(`Add ${label.source}`, 'i') }));
    }
    // £549 − £30 cap = £519, never £549 − £45.
    expect(quote().getAllByText('£519').length).toBeGreaterThan(0);
  });

  it('keeps "what\'s included" collapsed behind an accessible disclosure', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^2 bed$/);
    await advance(user);
    const toggle = quote().getByRole('button', { name: /What's included in every clean/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(quote().getByText(/Oven, hob, grill and extractor/i)).toBeInTheDocument();
  });

  it('offers exactly one primary action per step and ends on Secure my date', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToReview(user);
    await advance(user); // Review → Book
    expect(quote().getByText(/Step 5 of 5/i)).toBeInTheDocument();
    const secure = quote().getAllByRole('button', { name: /Secure my date/i });
    expect(secure.length).toBeGreaterThan(0);
    expect(secure[0]).toBeEnabled();
    expect(quote().queryByRole('button', { name: /^Continue$/i })).not.toBeInTheDocument();
  });

  it('states the deposit reassurance and keeps answers when going back', async () => {
    const user = userEvent.setup();
    renderPage();
    await pick(user, 'Property size', /^2 bed$/);
    await advance(user);
    await user.click(quote().getByRole('button', { name: 'Increase Full bathrooms' }));
    expect(quote().getAllByText('£419').length).toBeGreaterThan(0);
    await user.click(quote().getByRole('button', { name: 'Back' }));
    expect(quote().getByText(/Step 1 of 5/i)).toBeInTheDocument();
    expect(quote().getAllByText('£419').length).toBeGreaterThan(0);
    expect(
      quote().getAllByText(/£30 secures your preferred date and is included in your total/i).length,
    ).toBeGreaterThan(0);
  });
});
