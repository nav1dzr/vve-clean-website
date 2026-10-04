import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuoteCalculated } from './useQuoteCalculated';

vi.mock('../lib/privatePage', () => ({ canUseGoogleTags: () => true }));
const gtag = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('gtag', gtag); gtag.mockClear();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const events = (name: string) => gtag.mock.calls.filter((call) => call[1] === name);
function mount() {
  return renderHook(({ amount, eligible, signature }) =>
    useQuoteCalculated('carpet_upholstery', amount, eligible, signature), {
    initialProps: { amount: 8500, eligible: true, signature: 'restored' },
    wrapper: StrictMode,
  });
}
describe('quote diagnostics runtime', () => {
  it('does not count initial/restored quotes or pricebook refreshes as user activity', () => {
    const h = mount();
    h.rerender({ amount: 9000, eligible: true, signature: 'restored' });
    act(() => vi.advanceTimersByTime(1000));
    expect(gtag).not.toHaveBeenCalled();
  });
  it('starts once and debounces edits to one displayed amount under StrictMode', () => {
    const h = mount();
    h.rerender({ amount: 8500, eligible: true, signature: 'one-room' });
    act(() => vi.advanceTimersByTime(300));
    h.rerender({ amount: 11500, eligible: true, signature: 'two-rooms' });
    act(() => vi.advanceTimersByTime(599));
    expect(events('quote_calculated')).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));
    expect(events('quote_started')).toHaveLength(1);
    expect(events('quote_calculated')).toEqual([['event', 'quote_calculated', {
      event_category: 'funnel', service_type: 'carpet_upholstery', quoted_total: 115, currency: 'GBP',
    }]]);
    h.rerender({ amount: 11500, eligible: true, signature: 'two-rooms' });
    act(() => vi.advanceTimersByTime(1000));
    expect(events('quote_calculated')).toHaveLength(1);
    expect(events('conversion')).toHaveLength(0);
  });
  it.each([0, -10, Number.NaN, 2.5])('rejects invalid pence %s', (amount) => {
    const h = mount(); h.rerender({ amount, eligible: true, signature: 'edited' });
    act(() => vi.advanceTimersByTime(1000));
    expect(events('quote_calculated')).toHaveLength(0);
  });
  it('records interest but never a calculated quote for manual/invalid selections', () => {
    const h = mount(); h.rerender({ amount: 8500, eligible: false, signature: 'photo-review' });
    act(() => vi.advanceTimersByTime(1000));
    expect(events('quote_started')).toHaveLength(1);
    expect(events('quote_calculated')).toHaveLength(0);
  });
  it('cancels pending calculations on unmount', () => {
    const h = mount(); h.rerender({ amount: 8500, eligible: true, signature: 'edited' });
    h.unmount(); act(() => vi.advanceTimersByTime(1000));
    expect(events('quote_calculated')).toHaveLength(0);
  });
  it('does not report a calculation while the screen is hidden', () => {
    const h = mount(); h.rerender({ amount: 8500, eligible: true, signature: 'edited' });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => vi.advanceTimersByTime(1000));
    expect(events('quote_calculated')).toHaveLength(0);
  });
  it('can record resuming a saved quote without inventing a calculation', () => {
    const h = mount(); act(() => { h.result.current(); h.result.current(); });
    expect(events('quote_started')).toHaveLength(1);
    expect(events('quote_calculated')).toHaveLength(0);
  });
  it('does not break quoting if analytics is blocked or throws', () => {
    gtag.mockImplementation(() => { throw new Error('blocked'); });
    const h = mount(); h.rerender({ amount: 8500, eligible: true, signature: 'edited' });
    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow();
    gtag.mockReset();
  });
});
