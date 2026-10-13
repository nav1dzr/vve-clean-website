import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import QuoteCalculator from '../components/QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';
import { clearQuoteBasket } from '../lib/quoteBasket';
import { readBookingHandoff } from '../lib/bookingHandoff';
import BookingPage from './BookingPage';
import LeafletPage from './LeafletPage';

function CurrentQuote() {
  const location = useLocation();
  return <output data-testid="handoff">{JSON.stringify(readBookingHandoff(location.state)?.selection ?? null)}</output>;
}

function renderJourney(path = '/carpet-cleaning-london') {
  window.history.replaceState({}, '', path);
  return render(<MemoryRouter initialEntries={[path]}><BookingProvider>
    <CurrentQuote />
    <Routes>
      <Route path="/carpet-cleaning-london" element={<QuoteCalculator mode="carpet" />} />
      <Route path="/end-of-tenancy-cleaning-london" element={<QuoteCalculator mode="eot" />} />
      <Route path="/leaflet" element={<LeafletPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/" element={<QuoteCalculator />} />
    </Routes>
  </BookingProvider></MemoryRouter>);
}

function blockStorage(mode: 'methods' | 'getters') {
  const denied = () => { throw new DOMException('Storage is disabled', 'SecurityError'); };
  if (mode === 'getters') {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(denied);
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(denied);
  } else {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);
  }
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); clearQuoteBasket(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); clearQuoteBasket(); });

describe('booking handoff when the browser blocks storage', () => {
  it('recalculates a legacy config-only restore before handing a full selection to booking', async () => {
    sessionStorage.setItem('vve_booking', JSON.stringify({
      price: 9999,
      quoteConfig: { service: 'deep', deepService: 'carpet_upholstery', carpetCounts: { bedroom: 2 }, carpetCondition: 'normal' },
    }));
    sessionStorage.setItem('vve_restore_quote', '1');
    const user = userEvent.setup(); renderJourney();
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    const restored = JSON.parse(screen.getByTestId('handoff').textContent!);
    expect(restored.quoteConfig.carpetCounts.bedroom).toBe(2);
    expect(restored.price).toBe(100);
  });

  it.each(['methods', 'getters'] as const)('preserves selected carpets and the correct Back to quote route when storage %s throw', async mode => {
    blockStorage(mode);
    const user = userEvent.setup();
    renderJourney();
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('handoff').textContent!).quoteConfig.carpetCounts.bedroom).toBe(2);
    const back = screen.getByRole('link', { name: 'Back to quote' });
    expect(back).toHaveAttribute('href', '/carpet-cleaning-london#quote');
    await user.click(back);
    expect(screen.getAllByText('£100').length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);
    expect(JSON.parse(screen.getByTestId('handoff').textContent!).quoteConfig.carpetCounts.bedroom).toBe(2);
  });

  it('keeps a leaflet quote and the offer when session and local storage are blocked', async () => {
    blockStorage('getters');
    const user = userEvent.setup();
    renderJourney('/leaflet');
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    const selection = JSON.parse(screen.getByTestId('handoff').textContent!);
    expect(selection.quoteConfig.carpetCounts.bedroom).toBe(3);
    expect(selection.offerCode).toBe('LEAFLET20');
    expect(screen.getByRole('link', { name: 'Back to quote' })).toHaveAttribute('href', '/leaflet#quote');
  });

  it('continues from the EOT wizard to a usable form without browser storage', async () => {
    blockStorage('methods');
    const user = userEvent.setup();
    renderJourney('/end-of-tenancy-cleaning-london');
    await user.click(screen.getByRole('button', { name: 'Flat' }));
    await user.click(screen.getByRole('button', { name: /^Studio/ }));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /^Continue$/ }));
    await user.click(screen.getByRole('button', { name: /Request a time — no payment/ }));
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    const selection = JSON.parse(screen.getByTestId('handoff').textContent!);
    expect(selection.quoteConfig.deepService).toBe('end_of_tenancy');
    expect(selection.quoteConfig.deepSize).toBe('studio');
    expect(screen.getByRole('link', { name: 'Back to quote' })).toHaveAttribute('href', '/end-of-tenancy-cleaning-london#quote');
  });

  it('the inline booking calculator can open its details form without storage', async () => {
    blockStorage('methods');
    const user = userEvent.setup();
    renderJourney('/booking');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select a service' }), 'carpet');
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);
    expect(screen.getByRole('heading', { name: 'Request a preferred cleaning time' })).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('handoff').textContent!).quoteConfig.carpetCounts.bedroom).toBe(1);
  });

  it('returns an inline replacement service to the general quote instead of the old locked service page', async () => {
    blockStorage('getters');
    const user = userEvent.setup();
    renderJourney();
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getAllByRole('button', { name: /Request a time/i })[0]);
    await user.click(screen.getByRole('button', { name: 'Change service' }));
    await user.click(screen.getByRole('button', { name: 'End of tenancy' }));
    await user.click(screen.getByRole('button', { name: 'Flat' }));
    await user.click(screen.getByRole('button', { name: /^Studio/ }));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /^Continue$/ }));
    await user.click(screen.getByRole('button', { name: /Request a time — no payment/ }));
    const back = screen.getByRole('link', { name: 'Back to quote' });
    expect(back).toHaveAttribute('href', '/#quote');
    await user.click(back);
    expect(screen.getByRole('heading', { name: 'End of Tenancy Quote' })).toBeInTheDocument();
    expect(screen.getByText('Flat · Studio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Increase Bedroom quantity' })).not.toBeInTheDocument();
  });
});
