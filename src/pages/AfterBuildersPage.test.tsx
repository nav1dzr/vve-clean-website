import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import AfterBuildersPage from './AfterBuildersPage';
import ContactPage from './ContactPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { AFTER_BUILDERS_FROM_PRICES_P, penceToDisplay } from '../data/pricing';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/after-builders-cleaning-london']}>
      <CookieConsentProvider>
        <AfterBuildersPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// After Builders pricing genuinely depends on scope/photos, so — unlike EOT,
// Carpet and Sofa — this page must not get a fixed-price QuoteCalculator.
// The hero CTA is the early, prominent quote path here, and it must always
// go to the WhatsApp photo-quote flow, never to an invented "#quote" anchor
// that doesn't exist on this page.
describe('AfterBuildersPage — photo-quote CTA (no fixed-price calculator)', () => {
  it('renders a prominent hero CTA that opens the WhatsApp photo-quote conversation', () => {
    renderPage();

    const heroCta = screen.getAllByRole('link', { name: 'WhatsApp a photo for a quote' })[0];
    expect(heroCta).toHaveAttribute('href', expect.stringContaining('https://wa.me/447845451111'));
    expect(heroCta).toHaveAttribute('href', expect.stringContaining('after-builders%20clean%20quote'));
    expect(heroCta).toHaveAttribute('target', '_blank');
    expect(heroCta).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('never renders a fixed-price instant quote calculator on this page', () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: /Instant Quote/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
  });

  it('offers distinct photo-quote and telephone actions in the mobile bar', () => {
    renderPage();
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    expect(bar.getByRole('link', { name: 'WhatsApp a photo for a quote' })).toHaveAttribute('href', expect.stringContaining('after-builders%20clean%20quote'));
    expect(bar.getByRole('link', { name: 'Call VVE Clean on 020 8050 2233' })).toHaveAttribute('href', 'tel:02080502233');
    expect(bar.getAllByRole('link')).toHaveLength(2);
  });

  it('carries the service into the existing written enquiry and lets the customer change it', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/after-builders-cleaning-london']}><CookieConsentProvider><Routes><Route path="/after-builders-cleaning-london" element={<AfterBuildersPage />} /><Route path="/contact" element={<ContactPage />} /></Routes></CookieConsentProvider></MemoryRouter>);
    await user.click(screen.getAllByRole('link', { name: 'Send an enquiry' })[0]);
    const service = screen.getByLabelText(/service needed/i);
    expect(service).toHaveValue('After builders cleaning');
    await user.selectOptions(service, 'Carpet cleaning');
    expect(service).toHaveValue('Carpet cleaning');
  });

  it('ignores unrecognised service query values rather than echoing URL input', () => {
    render(<MemoryRouter initialEntries={['/contact?service=unrecognised']}><CookieConsentProvider><ContactPage /></CookieConsentProvider></MemoryRouter>);
    expect(screen.getByLabelText(/service needed/i)).toHaveValue('');
  });

  it('keeps every published starting price and structured-data minimum on the central catalogue', () => {
    const { container } = renderPage();
    const graph = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')['@graph'];
    const offers = graph.find((node: { '@type': string }) => node['@type'] === 'Service').offers;
    for (const [index, key] of ['small', 'studio', 'bed1', 'bed2', 'bed3', 'bed4'].entries()) {
      const expected = AFTER_BUILDERS_FROM_PRICES_P[key as keyof typeof AFTER_BUILDERS_FROM_PRICES_P];
      expect(container.querySelector(`[data-price-key="${key}"]`)?.textContent).toContain(`from ${penceToDisplay(expected)}`);
      expect(offers[index].priceSpecification.minPrice).toBe(expected / 100);
      expect(offers[index].description).toContain('Starting guide only');
      expect(offers[index].price).toBeUndefined();
    }
  });

  it('resolves every contents link to one uniquely labelled page section', () => {
    const { container } = renderPage();
    const links = container.querySelectorAll('nav[aria-label="After-builders page sections"] a');
    expect(links.length).toBe(6);
    for (const link of links) {
      const target = container.querySelectorAll(link.getAttribute('href')!);
      expect(target).toHaveLength(1);
      expect(target[0].getAttribute('aria-labelledby')).toBeTruthy();
    }
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps scope limits visible and distinguishes task disclosures from FAQs', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('details[data-disclosure="cleaning-checklist"]')).toHaveLength(6);
    expect(container.querySelectorAll('details[data-disclosure="cleaning-checklist"] summary')).toHaveLength(6);
    expect(screen.getByText(/possible tasks, not a promise/)).toBeInTheDocument();
    expect(screen.getByText(/cannot guarantee removal of every mark/)).toBeInTheDocument();
    expect(container.querySelector('#builders-faq')?.textContent).not.toMatch(/72.hour|7.day|6–8 hours/);
    expect(container.querySelector('#builders-results')?.textContent).toContain('No project results are pictured yet.');
    expect(container.querySelector('#builders-results img')).toBeNull();
  });
});
