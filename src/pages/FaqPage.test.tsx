import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FaqPage from './FaqPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { FAQ_ITEMS } from '../data/faq';

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

  it('includes every homepage FAQ question', () => {
    renderPage();
    expect(screen.getByText('How does the deposit-back guarantee work?')).toBeInTheDocument();
    expect(screen.getByText("What's included in an end of tenancy clean?")).toBeInTheDocument();
    expect(screen.getByText('Are your cleaners insured and vetted?')).toBeInTheDocument();
    expect(screen.getByText('Which areas do you cover?')).toBeInTheDocument();
    expect(screen.getByText('Do you clean occupied homes?')).toBeInTheDocument();
  });

  it('includes every Pricing-page mini-FAQ question', () => {
    renderPage();
    expect(screen.getByText('Are prices really fixed?')).toBeInTheDocument();
    expect(screen.getByText('Can I book same-day or next-day?')).toBeInTheDocument();
    expect(screen.getByText('Can the price change?')).toBeInTheDocument();
  });

  it('deduplicates questions shared by both sources', () => {
    renderPage();
    expect(screen.getAllByText('Can the price change?')).toHaveLength(1);
    expect(screen.getAllByText('When do I pay?')).toHaveLength(1);
    expect(screen.getAllByText('Do you clean occupied homes?')).toHaveLength(1);
  });

  it('renders exactly one accordion item per FAQ_ITEMS entry', () => {
    const { container } = render(
      <MemoryRouter>
        <CookieConsentProvider>
          <FaqPage />
        </CookieConsentProvider>
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('details.faq-item')).toHaveLength(FAQ_ITEMS.length);
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
