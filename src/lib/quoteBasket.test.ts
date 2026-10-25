import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearQuoteBasket, readQuoteBasket, saveQuoteBasket } from './quoteBasket';

const basket = (count: number) => ({ kind: 'standard' as const, label: 'Carpet clean', href: '', config: { deepService: 'carpet_upholstery', carpetCounts: { bedroom: count } } });
beforeEach(() => { clearQuoteBasket(); window.history.replaceState({}, '', '/carpet-cleaning-london'); });
afterEach(() => { vi.restoreAllMocks(); clearQuoteBasket(); });

describe('quote basket storage recovery', () => {
  it('uses the current selection when writes fail but an older value can still be read', () => {
    saveQuoteBasket(basket(1));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    saveQuoteBasket(basket(3));
    expect(readQuoteBasket()?.config.carpetCounts).toEqual({ bedroom: 3 });
  });

  it('uses the current selection when all browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    saveQuoteBasket(basket(2));
    expect(readQuoteBasket()?.config.carpetCounts).toEqual({ bedroom: 2 });
  });

  it('does not revive an older saved basket when removal is blocked', () => {
    saveQuoteBasket(basket(1));
    sessionStorage.setItem('vve_booking', 'old handoff');
    const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (this === localStorage) throw new Error('Blocked');
      remove.call(this, key);
    });
    clearQuoteBasket();
    expect(readQuoteBasket()).toBeNull();
    expect(sessionStorage.getItem('vve_booking')).toBeNull();
  });

  it('applies expiry to the in-memory fallback as well', () => {
    const now = Date.now();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    saveQuoteBasket(basket(1));
    vi.spyOn(Date, 'now').mockReturnValue(now + 15 * 86400000);
    expect(readQuoteBasket()).toBeNull();
  });
});
