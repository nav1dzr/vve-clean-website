import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FaqPage from './FaqPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import {
  FAQ_ITEMS,
  HOMEPAGE_FAQ_ITEMS,
  PRICING_FAQ_ITEMS,
  FAQ_ONLY_ITEMS,
  normalizeQuestion,
} from '../data/faq';
import { EOT_CARPET_PACKAGE_DISCOUNT_PCT, EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS, EOT_GUARANTEE_HOURS } from '../data/pricing';

function renderPage() {
  render(
    <MemoryRouter>
      <CookieConsentProvider>
        <FaqPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('FaqPage', () => {
  it('renders Navbar, a single main landmark and Footer — not a blank page', () => {
    renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('includes every question from every source array — not a handpicked subset', () => {
    const normalizedFaqQuestions = new Set(FAQ_ITEMS.map((item) => normalizeQuestion(item.q)));
    for (const source of [HOMEPAGE_FAQ_ITEMS, PRICING_FAQ_ITEMS, FAQ_ONLY_ITEMS]) {
      for (const item of source) {
        expect(normalizedFaqQuestions.has(normalizeQuestion(item.q))).toBe(true);
      }
    }
  });

  it('has no duplicate normalized question in the merged list', () => {
    const normalized = FAQ_ITEMS.map((item) => normalizeQuestion(item.q));
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('renders exactly one accordion item per FAQ_ITEMS entry, matching the source-array count after dedup', () => {
    const { container } = render(
      <MemoryRouter>
        <CookieConsentProvider>
          <FaqPage />
        </CookieConsentProvider>
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('details.faq-item')).toHaveLength(FAQ_ITEMS.length);

    const allSourceQuestions = [...HOMEPAGE_FAQ_ITEMS, ...PRICING_FAQ_ITEMS, ...FAQ_ONLY_ITEMS].map((i) =>
      normalizeQuestion(i.q),
    );
    const expectedUniqueCount = new Set(allSourceQuestions).size;
    expect(FAQ_ITEMS.length).toBe(expectedUniqueCount);
  });

  it('adds the carpet add-on question with the canonical discount and qualifying-area rule (not unconditional 50%)', () => {
    renderPage();
    const text = document.body.textContent || '';
    expect(text).toMatch(/Can I add carpet cleaning to my end of tenancy booking\?/);
    expect(text).toContain(`save up to ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}%`);
    expect(text).toContain(`${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} or more qualifying areas`);
    expect(text).toMatch(/fewer than 3.*normal standalone rate/i);
  });

  it('adds the letting-agent question, scoped to the Complete package and canonical guarantee hours', () => {
    renderPage();
    const text = document.body.textContent || '';
    expect(text).toMatch(/What if my letting agent flags something after the clean\?/);
    expect(text).toContain(`Complete End of Tenancy package`);
    expect(text).toContain(`within ${EOT_GUARANTEE_HOURS} hours`);
    expect(text).toMatch(/Tailored package and other services are not covered/);
  });

  it('adds the deposit-refund question for an unavailable slot, without claiming an automated or timed refund', () => {
    renderPage();
    const text = document.body.textContent || '';
    expect(text).toMatch(/What happens to my deposit if my requested slot is unavailable\?/);
    expect(text).toMatch(/refunded to your original payment method/i);
    expect(text.toLowerCase()).not.toMatch(/\bautomatically\b/);
    expect(text).not.toMatch(/\d+\s*business days/i);
  });

  it('keeps "Do you clean occupied homes?" exactly once despite appearing in two sources', () => {
    renderPage();
    expect(screen.getAllByText('Do you clean occupied homes?')).toHaveLength(1);
    expect(screen.getAllByText('Can the price change?')).toHaveLength(1);
    expect(screen.getAllByText('When do I pay?')).toHaveLength(1);
  });

  it('emits FAQPage JSON-LD schema matching the rendered questions', () => {
    const { container } = render(
      <MemoryRouter>
        <CookieConsentProvider>
          <FaqPage />
        </CookieConsentProvider>
      </MemoryRouter>,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const schema = JSON.parse(script!.innerHTML);
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(FAQ_ITEMS.length);
  });
});
