import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EndOfTenancyPage from './EndOfTenancyPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/end-of-tenancy-cleaning-london']}>
      <CookieConsentProvider>
        <EndOfTenancyPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('EndOfTenancyPage — complete package', () => {
  it('presents the approved complete-package proposition and EOT-only quote', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: /Complete End of Tenancy Cleaning London/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Build Your Complete Clean/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
    expect(screen.getAllByText('Oven, hob, grill and extractor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inside emptied fridge and defrosted freezer').length).toBeGreaterThan(0);
    expect(screen.getByText('2-seater sofa steam clean')).toBeInTheDocument();
    expect(screen.getByText('Double / king mattress steam clean')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flat / apartment' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'House / maisonette' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('prices the approved four-bedroom house carpet example transparently, including the +£35 house adjustment', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'House / maisonette' }));
    await user.click(screen.getByRole('button', { name: '4 Bed' }));
    await user.click(screen.getByRole('button', {
      name: 'Increase 4 bedroom carpets + hallway + landing quantity',
    }));
    await user.click(screen.getByRole('button', {
      name: 'Increase Living / dining room carpet quantity',
    }));
    await user.click(screen.getByRole('button', {
      name: 'Increase Flights of stairs quantity',
    }));

    // £549 base + £35 house adjustment + £195 carpets + £55 living carpet + £45 stairs = £879
    expect(screen.getAllByText('£879').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4 bedroom carpets + hallway + landing').length).toBeGreaterThan(0);
    expect(screen.getByText('House/maisonette adjustment')).toBeInTheDocument();
  });

  it('prices a 4-bed house base at £584 (£549 base + £35 house adjustment) with no other extras', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'House / maisonette' }));
    await user.click(screen.getByRole('button', { name: '4 Bed' }));

    expect(screen.getAllByText('£584').length).toBeGreaterThan(0);
  });

  it('does not add the house adjustment for a flat at 4 Bed (£549)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '4 Bed' }));

    expect(screen.getAllByText('£549').length).toBeGreaterThan(0);
    expect(screen.queryByText('House/maisonette adjustment')).not.toBeInTheDocument();
  });

  it('routes 5+ bedroom properties to a tailored quote with no fixed total shown', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '5+ Bedrooms' }));

    expect(screen.getByText('Tailored Quote Required')).toBeInTheDocument();
    expect(screen.getAllByText('Tailored quote').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Request tailored quote →' })).toHaveAttribute(
      'href',
      expect.stringContaining('5%2B%20bedroom'),
    );
    expect(screen.getByRole('link', { name: 'Request a quote via WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining('5%2B%20bedroom'),
    );
    expect(screen.getByText(/5\+ bedrooms · tailored quote required/i)).toBeInTheDocument();
    // Neither "Book online" CTA variant is offered for a tailored quote —
    // WhatsApp is the only path forward, matching the after-builders pattern.
    expect(screen.queryByRole('button', { name: /Book online/i })).not.toBeInTheDocument();
  });

  it('caps scope reductions and clearly changes the product to Custom EOT', async () => {
    const user = userEvent.setup();
    renderPage();

    const scopeDetails = screen
      .getByText('Already cleaned something? Reduce the scope')
      .closest('details');

    if (!scopeDetails) {
      throw new Error('Scope-reduction details element was not rendered');
    }

    const scopeCheckboxes = scopeDetails.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(scopeCheckboxes).toHaveLength(4);

    for (const checkbox of scopeCheckboxes) {
      await user.click(checkbox);
    }

    expect(screen.getAllByText(/Custom EOT clean/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/£30 credit is applied/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('£339').length).toBeGreaterThan(0);
  });
});
