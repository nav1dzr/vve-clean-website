// Business guarantees for the End of Tenancy page, asserted through the
// redesigned quote UI.
//
// These are the same commitments the previous calculator-driven tests pinned —
// the £35 house adjustment, the documented £584 four-bed-house example, the
// 5+ tailored-quote route and the capped scope credit. Only the interactions
// changed with the redesign; the promises did not. Pure-arithmetic coverage
// additionally lives in src/lib/eotPricing.test.ts.

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
 * Scopes queries to the quote itself. The page also carries a static pricing
 * table that repeats phrases like "House / maisonette adjustment", so page-wide
 * queries would match copy the customer never sees inside the calculator.
 */
function quote() {
  const el = document.getElementById('quote');
  if (!el) throw new Error('quote section not found');
  return within(el);
}

/** Each access question is its own fieldset, so Yes/No must be scoped to one. */
function parkingQuestion() {
  return within(quote().getByRole('group', { name: /free parking available/i }));
}
function congestionQuestion() {
  return within(quote().getByRole('group', { name: /Congestion Charge zone/i }));
}

/** Answers the two required access questions with the zero-charge options. */
async function answerAccess(user: ReturnType<typeof userEvent.setup>) {
  await user.click(parkingQuestion().getByRole('button', { name: 'Yes' }));   // free parking
  await user.click(congestionQuestion().getByRole('button', { name: 'No' })); // outside zone
}

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(quote().getByRole('button', { name }));
}

describe('EndOfTenancyPage — complete package', () => {
  it('presents the approved proposition and an EOT-only quote', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Complete End of Tenancy Cleaning London/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Build your complete quote/i }),
    ).toBeInTheDocument();
    // No service switcher: this page sells one product.
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
    expect(screen.getAllByText('Oven, hob, grill and extractor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inside emptied fridge and defrosted freezer').length).toBeGreaterThan(0);
  });

  it('shows a price immediately after property type and size, before any other question', async () => {
    const user = userEvent.setup();
    renderPage();
    // Nothing is priced until a size is chosen — an explicit empty state.
    expect(quote().getByText(/Your price appears here/i)).toBeInTheDocument();
    await choose(user, '2 bedrooms');
    expect(quote().getAllByText('£369').length).toBeGreaterThan(0);
  });

  it('prices a 4-bed house at £584 (£549 base + £35 house adjustment)', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, 'House or maisonette, adds £35');
    await choose(user, '4 bedrooms');
    expect(quote().getAllByText('£584').length).toBeGreaterThan(0);
    expect(quote().getAllByText(/House \/ maisonette adjustment/i).length).toBeGreaterThan(0);
  });

  it('does not add the house adjustment for a flat at 4 bedrooms (£549)', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '4 bedrooms');
    expect(quote().getAllByText('£549').length).toBeGreaterThan(0);
    expect(quote().queryByText(/House \/ maisonette adjustment/i)).not.toBeInTheDocument();
  });

  it('adds £50 per additional bathroom and £25 per additional WC', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '2 bedrooms');
    await user.click(quote().getByRole('button', { name: 'Add one Full bathrooms' }));
    expect(quote().getAllByText('£419').length).toBeGreaterThan(0);
    await user.click(quote().getByRole('button', { name: 'Add one Additional WC' }));
    expect(quote().getAllByText('£444').length).toBeGreaterThan(0);
  });

  it('routes 5+ bedroom properties to a tailored quote with no fixed total', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '5+ bedrooms');
    expect(quote().getAllByText(/Tailored quote/i)[0]).toBeInTheDocument();
    expect(
      quote().getByRole('link', { name: /Request my tailored quote/i }),
    ).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(quote().queryByRole('button', { name: /Book online/i })).not.toBeInTheDocument();
  });

  it('caps the scope credit at £30 and never applies more than requested', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '4 bedrooms');
    for (const label of [
      /Oven is already inspection-ready/i,
      /Fridge\/freezer is empty and inspection-ready/i,
      /Empty cupboards are already inspection-ready/i,
      /Internal windows are already cleaned/i,
    ]) {
      await user.click(quote().getByRole('checkbox', { name: label }));
    }
    // £549 − £30 cap = £519, never £549 − £45.
    expect(quote().getAllByText('£519').length).toBeGreaterThan(0);
    expect(quote().getAllByText(/Credit applied: −£30/i).length).toBeGreaterThan(0);
  });

  it('keeps access charges out of the base price but shows them in the total', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '2 bedrooms');
    await user.click(parkingQuestion().getByRole('button', { name: 'No' }));      // no parking → +£15
    await user.click(congestionQuestion().getByRole('button', { name: 'Yes' })); // in zone   → +£18
    expect(quote().getAllByText('£402').length).toBeGreaterThan(0);
    expect(quote().getAllByText(/Congestion Charge \(pass-through\)/i).length).toBeGreaterThan(0);
  });

  it('only enables booking once both access questions are answered', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '2 bedrooms');
    const bookBtn = quote().getAllByRole('button', { name: /Book online — pay £30 deposit/i })[0];
    expect(bookBtn).toBeDisabled();
    expect(quote().getAllByText(/Answer the two access questions/i).length).toBeGreaterThan(0);
    await answerAccess(user);
    expect(
      quote().getAllByRole('button', { name: /Book online — pay £30 deposit/i })[0],
    ).toBeEnabled();
  });

  it('states the £30 deposit reassurance and the remaining balance', async () => {
    const user = userEvent.setup();
    renderPage();
    await choose(user, '2 bedrooms');
    await answerAccess(user);
    expect(
      quote().getAllByText(/£30 secures your preferred date and is included in your total/i).length,
    ).toBeGreaterThan(0);
    expect(quote().getAllByText(/Balance after your clean/i).length).toBeGreaterThan(0);
    expect(quote().getAllByText('£339').length).toBeGreaterThan(0); // £369 − £30 deposit
  });
});
