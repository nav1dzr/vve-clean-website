import { useState } from 'react';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BasketButton from './BasketButton';
import QuoteCalculator from './QuoteCalculator';
import { BookingProvider } from '../context/BookingContext';
import { clearQuoteBasket, readQuoteBasket, saveQuoteBasket } from '../lib/quoteBasket';
import type { HomepageQuoteService } from './HomeServiceSelector';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  window.history.replaceState({ marker: 'keep router state' }, '', '/#quote');
  clearQuoteBasket();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); clearQuoteBasket(); });

function observeReload() {
  const browser = window;
  const reload = vi.fn();
  // JSDOM cannot reload documents. Replace only the window-facing location
  // adapter; all DOM/history/storage objects remain the real test instances.
  const location = {
    get origin() { return browser.location.origin; },
    get pathname() { return browser.location.pathname; },
    get search() { return browser.location.search; },
    get href() { return browser.location.href; },
    reload,
  };
  vi.stubGlobal('window', new Proxy(browser, {
    get(target, key) { return key === 'location' ? location : Reflect.get(target, key, target); },
  }));
  return reload;
}

function HomeQuote() {
  const [service, setService] = useState<HomepageQuoteService | null>(null);
  return <MemoryRouter><BookingProvider>
    <BasketButton />
    <button type="button" onClick={() => setService('move_in')}>Choose a new Move-in clean</button>
    <QuoteCalculator key={service ?? 'chooser'} homepageMode homepageService={service} onHomepageServiceChange={setService} aboveFold />
  </BookingProvider></MemoryRouter>;
}

async function openBasket(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Your basket/ }));
  return within(screen.getByRole('dialog'));
}

describe('BasketButton — deliberate quote restoration and reset', () => {
  it('resumes saved carpet items after a different service was chosen without reloading the page', async () => {
    const user = userEvent.setup();
    const reload = observeReload();
    render(<HomeQuote />);
    await user.selectOptions(screen.getByRole('combobox'), 'carpet');
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    expect(readQuoteBasket()?.config.carpetCounts).toMatchObject({ bedroom: 1 });
    await user.click(screen.getByRole('button', { name: 'Choose a new Move-in clean' }));
    expect(screen.queryByRole('button', { name: 'Decrease Bedroom quantity' })).not.toBeInTheDocument();
    expect(readQuoteBasket()?.config.deepService).toBe('carpet_upholstery');
    const basket = await openBasket(user);
    await user.click(basket.getByRole('link', { name: 'Continue my quote' }));
    expect(reload).not.toHaveBeenCalled();
    expect(window.history.state).toEqual({ marker: 'keep router state' });
    expect(window.location.href).toMatch(/\/#quote$/);
    expect(screen.getByRole('button', { name: 'Decrease Bedroom quantity' })).toBeEnabled();
    expect(screen.getAllByText('£85').length).toBeGreaterThan(0);
    // Actual HomePage pattern: its external Services choice must not stay stale.
    await user.click(screen.getByRole('button', { name: 'Choose a new Move-in clean' }));
    expect(screen.getByRole('button', { name: '2 Bed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decrease Bedroom quantity' })).not.toBeInTheDocument();
  });

  it('removes the saved basket and starts a fresh chooser without a document reload', async () => {
    const user = userEvent.setup();
    const reload = observeReload();
    render(<HomeQuote />);
    await user.selectOptions(screen.getByRole('combobox'), 'carpet');
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click(screen.getByRole('button', { name: 'Choose a new Move-in clean' }));
    let basket = await openBasket(user);
    await user.click(basket.getByRole('button', { name: 'Remove saved basket' }));
    expect(readQuoteBasket()).toBeNull();
    basket = await openBasket(user);
    await user.click(basket.getByRole('link', { name: 'Start my quote' }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Increase Bedroom quantity' })).not.toBeInTheDocument();
  });

  it('keeps a quote usable when saves fail but reads still work, including resume and a new service choice', async () => {
    const user = userEvent.setup();
    const reload = observeReload();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    render(<HomeQuote />);
    await user.selectOptions(screen.getByRole('combobox'), 'carpet');
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    expect(readQuoteBasket()?.config.carpetCounts).toMatchObject({ bedroom: 1 });
    await user.click(screen.getByRole('button', { name: 'Choose a new Move-in clean' }));
    await user.click((await openBasket(user)).getByRole('link', { name: 'Continue my quote' }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Decrease Bedroom quantity' })).toBeEnabled();
    expect(screen.getAllByText('£85').length).toBeGreaterThan(0);
    await user.click((await openBasket(user)).getByRole('button', { name: 'Remove saved basket' }));
    await user.click((await openBasket(user)).getByRole('link', { name: 'Start my quote' }));
    // The old parent selection was Move-in. Selecting it again must still work.
    await user.selectOptions(screen.getByRole('combobox'), 'move_in');
    expect(screen.getByRole('button', { name: '2 Bed' })).toBeInTheDocument();
  });

  it('keeps campaign query parameters when resuming on the same page', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/?utm_source=test#quote');
    const reload = observeReload();
    render(<HomeQuote />);
    await user.selectOptions(screen.getByRole('combobox'), 'carpet');
    await user.click(screen.getByRole('button', { name: 'Increase Bedroom quantity' }));
    await user.click((await openBasket(user)).getByRole('link', { name: 'Continue my quote' }));
    expect(window.location.search).toBe('?utm_source=test');
    expect(reload).not.toHaveBeenCalled();
  });

  it('returns to the saved service through client navigation when the basket exists only in memory', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    window.history.replaceState({}, '', '/carpet-cleaning-london');
    saveQuoteBasket({ kind: 'standard', label: 'Carpet clean', href: '', config: { service: 'deep', deepService: 'carpet_upholstery', carpetCounts: { bedroom: 2 } } });
    window.history.replaceState({}, '', '/gallery');
    const reload = observeReload();
    render(<MemoryRouter initialEntries={['/gallery']}><BookingProvider><BasketButton /><Routes>
      <Route path="/gallery" element={<p>Exploring the gallery</p>} />
      <Route path="/carpet-cleaning-london" element={<QuoteCalculator mode="carpet" />} />
    </Routes></BookingProvider></MemoryRouter>);
    await user.click((await openBasket(user)).getByRole('link', { name: 'Continue my quote' }));
    expect(screen.queryByText('Exploring the gallery')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease Bedroom quantity' })).toBeEnabled();
    expect(screen.getAllByText('£100').length).toBeGreaterThan(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('sets the quote hash before reloading when the current same-page URL has no fragment', async () => {
    const user = userEvent.setup();
    window.history.replaceState({ marker: 'keep router state' }, '', '/');
    const reload = observeReload();
    render(<BasketButton />);
    const basket = await openBasket(user);
    await user.click(basket.getByRole('link', { name: 'Start my quote' }));
    expect(window.location.href).toMatch(/\/#quote$/);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('keeps cross-page and modified clicks native rather than reloading the wrong page', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/carpet-cleaning-london');
    saveQuoteBasket({ kind: 'standard', label: 'Carpet clean', href: '', config: { deepService: 'carpet_upholstery' } });
    window.history.replaceState({}, '', '/#quote');
    const reload = observeReload();
    render(<BasketButton />);
    const basket = await openBasket(user);
    const link = basket.getByRole('link', { name: 'Continue my quote' });
    expect(link).toHaveAttribute('href', '/carpet-cleaning-london#quote');
    // Prevent JSDOM's unsupported navigation after observing whether React
    // intercepted it, rather than treating its absence as browser behaviour.
    const prevented: boolean[] = [];
    const observe = (event: Event) => { prevented.push(event.defaultPrevented); event.preventDefault(); };
    document.addEventListener('click', observe);
    try {
      fireEvent.click(link);
      expect(prevented.pop()).toBe(false);
      expect(reload).not.toHaveBeenCalled();
      // The same-page modifier path also remains native (new-tab intent).
      link.setAttribute('href', '/#quote');
      fireEvent.click(link, { ctrlKey: true });
      expect(prevented.pop()).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('click', observe);
    }
  });
});
