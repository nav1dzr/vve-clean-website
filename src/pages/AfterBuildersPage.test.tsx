import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import AfterBuildersPage from './AfterBuildersPage';
import ContactPage from './ContactPage';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { AFTER_BUILDERS_START_FROM_P, PRESSURE_WASHING_FROM_P, GARDEN_SERVICES_FROM_P, GARDEN_SERVICES_MIN_P, WINDOW_CLEANING_FROM_P, WINDOW_CLEANING_MIN_P, penceToDisplay } from '../data/pricing';
import { BUILDERS_BUDGET_GUIDE, BUILDERS_LEVELS, BUILDERS_FAQS, BUILDERS_GUIDE_HREF, BUILDERS_QUOTE_HREF, formatBuildersRange } from '../data/afterBuildersContent';
import { AFTER_BUILDERS_DRAFT_KEY } from '../lib/afterBuildersEnquiry';

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

beforeEach(() => localStorage.removeItem(AFTER_BUILDERS_DRAFT_KEY));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/after-builders-cleaning-london']}>
      <CookieConsentProvider>
        <AfterBuildersPage />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

// The budget guide helps planning; only an assessed written quotation can set
// a booking total. Exercise the real shared header and sticky action components.
describe('AfterBuildersPage — budget guide and assessed enquiry', () => {
  it('takes the hero action to the guided enquiry and keeps photos as a separate choice', () => {
    const { container } = renderPage();
    const hero = within(container.querySelector<HTMLElement>('.service-hero')!);
    expect(hero.getByRole('link', { name: 'Get my cleaning quote' })).toHaveAttribute('href', '#builders-quote');
    const photoLink = hero.getByRole('link', { name: 'Send photos on WhatsApp' });
    expect(photoLink).toHaveAttribute('href', expect.stringContaining('after-builders%20clean%20quote'));
    expect(photoLink).toHaveAttribute('target', '_blank');
    expect(photoLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
    const target = container.querySelector('#builders-quote');
    expect(target?.querySelector('form')).not.toBeNull();
    expect(within(target as HTMLElement).getByRole('heading', { name: 'Tell us about the property' })).toBeInTheDocument();
  });

  it('never renders a fixed-price instant quote calculator on this page', () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: /Instant Quote/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Service Type')).not.toBeInTheDocument();
  });

  it('keeps the actual header and sticky actions anchored to the one enquiry form', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: 'Get my cleaning quote' })).toHaveAttribute('href', '#builders-quote');
    const bar = within(screen.getByRole('navigation', { name: 'Quick booking and help' }));
    expect(bar.getByRole('link', { name: 'Get my cleaning quote' })).toHaveAttribute('href', '#builders-quote');
    expect(bar.getByRole('link', { name: 'WhatsApp — send after-builders photos' })).toHaveAttribute('href', expect.stringContaining('after-builders%20clean%20quote'));
    expect(bar.getAllByRole('link')).toHaveLength(2);
    expect(bar.queryByRole('button', { name: 'Get my price' })).not.toBeInTheDocument();
    await user.click(header.getByRole('button', { name: 'Open menu' }));
    const menu = within(container.querySelector<HTMLElement>('#mobile-nav-menu')!);
    expect(menu.getByRole('link', { name: 'Get my cleaning quote' })).toHaveAttribute('href', '#builders-quote');
    expect(container.querySelectorAll('#builders-quote')).toHaveLength(1);
    expect(container.querySelectorAll('#builders-quote form')).toHaveLength(1);
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

  it('renders every approved budget range and row note from the shared display guide', () => {
    const { container } = renderPage();
    const table = screen.getByRole('table', { name: /indicative after-builders cleaning budgets/i });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(BUILDERS_BUDGET_GUIDE.length);
    for (const row of BUILDERS_BUDGET_GUIDE) {
      const displayed = table.querySelector(`[data-price-key="${row.key}"]`)!;
      expect(displayed.querySelector('th')).toHaveTextContent(row.label);
      expect(displayed.querySelector('small')).toHaveTextContent(row.note);
      for (const level of BUILDERS_LEVELS) {
        expect(displayed.querySelector(`[data-level-column="${level.key}"]`)).toHaveTextContent(formatBuildersRange(row[level.key]));
      }
    }
    const card = screen.getByRole('complementary', { name: 'After-builders budget at a glance' });
    expect(card).toHaveTextContent(formatBuildersRange(BUILDERS_BUDGET_GUIDE[0].standard));
    expect(container.querySelector('#builders-prices')).toHaveTextContent('planning ranges, not fixed packages or a checkout total');
  });

  it('compares cleaning levels through keyboard-operable buttons with one selected level', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const picker = within(screen.getByRole('group', { name: 'Choose cleaning level to compare budgets' }));
    const panel = container.querySelector('.builders-budget-panel');
    expect(picker.getByRole('button', { name: 'Standard clean' })).toHaveAttribute('aria-pressed', 'true');
    for (const level of BUILDERS_LEVELS) {
      const button = picker.getByRole('button', { name: level.label });
      button.focus();
      await user.keyboard(' ');
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(picker.getAllByRole('button').filter(item => item.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
      expect(panel).toHaveAttribute('data-level', level.key);
      expect(panel?.querySelector(`.builders-budget-definitions [data-level-column="${level.key}"]`)).toHaveTextContent(level.description);
    }
  });

  it('does not publish budget ranges as fixed-price offers in structured data', () => {
    const { container } = renderPage();
    const json = container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}';
    const graph = JSON.parse(json)['@graph'];
    const service = graph.find((node: { '@type': string }) => node['@type'] === 'Service');
    expect(service).toMatchObject({ name: 'After Builders Cleaning London', url: 'https://www.vveclean.co.uk/after-builders-cleaning-london' });
    expect(service.description).toContain('fixed written quote after assessment');
    expect(service.offers).toBeUndefined();
    expect(json).not.toMatch(/"(?:Offer|AggregateOffer|price|priceSpecification|minPrice|maxPrice)"/);
    const faq = graph.find((node: { '@type': string }) => node['@type'] === 'FAQPage');
    expect(faq.mainEntity).toEqual(BUILDERS_FAQS.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })));
  });

  it('uses catalogue starting prices for outdoor extras without implying fixed add-on units', () => {
    const { container } = renderPage();
    const extras = within(container.querySelector<HTMLElement>('#builders-extras')!);
    const rows = [
      ['Driveway, patio & paths', PRESSURE_WASHING_FROM_P],
      ['Garden tidy & maintenance', GARDEN_SERVICES_FROM_P],
      ['Exterior window cleaning', WINDOW_CLEANING_FROM_P],
    ] as const;
    for (const [name, price] of rows) {
      const row = extras.getByRole('heading', { name }).closest('article');
      expect(row?.querySelector('.builders-extra-price')).toHaveTextContent(`From ${penceToDisplay(price)}`);
    }
    expect(extras.getByRole('heading', { name: 'Garden tidy & maintenance' }).closest('article')).toHaveTextContent(`Minimum standalone visit ${penceToDisplay(GARDEN_SERVICES_MIN_P)}`);
    expect(extras.getByRole('heading', { name: 'Exterior window cleaning' }).closest('article')).toHaveTextContent(`Minimum standalone visit ${penceToDisplay(WINDOW_CLEANING_MIN_P)}`);
    expect(extras.getByText(/not fixed add-on fees or a guaranteed combined discount/)).toBeInTheDocument();
    expect(extras.getByText(/this is not a per-window price/)).toBeInTheDocument();
  });

  it('keeps the existing limited-area starting price separate from the whole-property budgets', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const summary = screen.getByText('Only one area, or not sure which clean you need?');
    const detail = summary.closest('details');
    expect(detail).not.toHaveAttribute('open');
    await user.click(summary);
    expect(detail).toHaveAttribute('open');
    expect(detail).toHaveTextContent(`A small renovation or one main area starts from ${penceToDisplay(AFTER_BUILDERS_START_FROM_P)} after assessment`);
    expect(detail).toHaveTextContent('limited-area guide, not a whole-property price');
    expect(container.querySelector('.builders-price-table')).not.toHaveTextContent(penceToDisplay(AFTER_BUILDERS_START_FROM_P));
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
    for (const href of [BUILDERS_GUIDE_HREF, BUILDERS_QUOTE_HREF]) {
      expect(href.split('#')[0]).toBe('/after-builders-cleaning-london');
      expect(container.querySelectorAll(`#${href.split('#')[1]}`)).toHaveLength(1);
    }
    const ids = Array.from(container.querySelectorAll('[id]'), item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps scope limits visible and distinguishes task disclosures from FAQs', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('details[data-disclosure="cleaning-checklist"]')).toHaveLength(6);
    expect(container.querySelectorAll('details[data-disclosure="cleaning-checklist"] summary')).toHaveLength(6);
    expect(screen.getByText(/it is not an unlimited package/)).toBeInTheDocument();
    expect(screen.getByText(/cannot guarantee removal of every mark/)).toBeInTheDocument();
    expect(container.querySelector('#builders-faq')?.textContent).not.toMatch(/72.hour|7.day|6–8 hours/);
    expect(container.querySelector('#builders-results')?.textContent).toContain('No after-builders project results are pictured yet.');
    expect(container.querySelector('#builders-results img')).toBeNull();
  });
});
