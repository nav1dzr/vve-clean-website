import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { CookieConsentProvider } from './context/CookieConsentContext';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClientAppRoutes from './ClientAppRoutes';
import { preloadClientRoute } from './clientRoutePages';
import ScrollToTop from './components/ScrollToTop';
import { readQuoteBasket, saveQuoteBasket } from './lib/quoteBasket';

const gate = vi.hoisted(() => {
  let resolve!: () => void;
  const ready = new Promise<void>(done => { resolve = done; });
  return { ready, resolve };
});
vi.mock('./pages/ContactPage', async () => {
  await gate.ready;
  return { default: () => <main id="main-content"><h1>Contact page ready</h1><section id="quote">Request a clean</section></main> };
});
vi.mock('./pages/PricingPage', () => ({ default: () => <main id="main-content"><h1>Pricing page ready</h1></main> }));
vi.mock('./pages/AboutPage', () => { throw new Error('Failed to fetch dynamically imported page'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('split client routes', () => {
  it('announces a slow page and focuses its quote target after the page finishes loading', async () => {
    render(<MemoryRouter initialEntries={['/contact#quote']}><ScrollToTop /><ClientAppRoutes /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading page');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    // Deliberately exceed the old one-shot 80 ms hash-focus timer.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    expect(document.getElementById('quote')).toBeNull();
    await act(async () => { gate.resolve(); await gate.ready; });
    expect(await screen.findByRole('heading', { name: 'Contact page ready' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement?.id).toBe('quote'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the preloaded initial route without replacing its content with a loading state', async () => {
    await preloadClientRoute('/pricing');
    render(<MemoryRouter initialEntries={['/pricing']}><ClientAppRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Pricing page ready' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps focus on the real gallery tab after a category changes the query string', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }));
    const scroll = vi.spyOn(window, 'scrollTo');
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/gallery']}><CookieConsentProvider><ScrollToTop /><ClientAppRoutes /></CookieConsentProvider></MemoryRouter>);
    const heading = await screen.findByRole('heading', { level: 1, name: 'VVE Clean Gallery' });
    await waitFor(() => expect(heading).toHaveFocus());
    scroll.mockClear();

    screen.getByRole('tab', { name: 'End of Tenancy' }).focus();
    await user.keyboard('{ArrowRight}');
    // The gallery replaces ?category=... without leaving its current page.
    // Wait beyond the route-focus timer: an immediate assertion misses the bug.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    const carpet = screen.getByRole('tab', { name: 'Carpet' });
    expect(carpet).toHaveAttribute('aria-selected', 'true');
    expect(carpet).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', carpet.id);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('offers recovery for a failed page chunk while leaving the saved basket intact', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    saveQuoteBasket({ kind: 'standard', label: 'Bedroom carpet cleaning', href: '', config: { deepService: 'carpet_upholstery', carpetCounts: { bedroom: 1 } } });
    const saved = readQuoteBasket();
    render(<MemoryRouter initialEntries={['/about']}><ClientAppRoutes /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please reload the page');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to the homepage' })).toHaveAttribute('href', '/');
    expect(readQuoteBasket()).toEqual(saved);
  });
});
