import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookingRouteState, isBookingSelection, readBookingHandoff, readStoredBookingSelection, readStoredQuoteConfig, storeBookingSelection } from './bookingHandoff';
import { getQuoteOriginHref } from './quoteOrigin';
import type { BookingSelection } from '../components/QuoteCalculator';

const selection: BookingSelection = {
  serviceName: 'Carpet cleaning', price: 100,
  quoteConfig: { service: 'deep', deepService: 'carpet_upholstery', deepSize: 'bed2', deepBaths: 1, addOnCounts: {}, carpetCounts: { bedroom: 2 }, windowSize: 'small', gutterType: 'terraced', officeHours: 2 },
};

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

describe('booking handoff trust and fallback', () => {
  it('accepts a valid router handoff and an explicit return-to-quote selection', () => {
    expect(readBookingHandoff(bookingRouteState(selection, '/carpet-cleaning-london', true))).toEqual({ selection, quoteOrigin: '/carpet-cleaning-london', restoreQuote: true });
  });
  it.each([null, {}, { serviceName: 'Old link', price: 30 }, { ...selection, price: NaN }, { ...selection, quoteConfig: { ...selection.quoteConfig, carpetCounts: { bedroom: '2' } } }, { ...selection, quoteConfig: [] }])('rejects an invalid or legacy selection %#', invalid => {
    expect(isBookingSelection(invalid)).toBe(false);
    expect(readBookingHandoff({ vveBooking: { selection: invalid, quoteOrigin: '/' } })).toBeNull();
  });
  it('rejects malformed storage and restores a valid stored quote', () => {
    sessionStorage.setItem('vve_booking', '{');
    expect(readStoredBookingSelection()).toBeNull();
    storeBookingSelection(selection);
    expect(readStoredBookingSelection()).toEqual(selection);
  });
  it.each([
    { service: 'window', windowSize: 'medium' },
    { service: 'gutter', gutterType: 'terraced' },
    { service: 'office', officeHours: 3 },
  ])('accepts a valid legacy $service selection without an unrelated deepService', config => {
    const legacy = { serviceName: 'Legacy service', price: 120, quoteConfig: config };
    sessionStorage.setItem('vve_booking', JSON.stringify(legacy));
    expect(readStoredBookingSelection()).toEqual(legacy);
  });
  it('restores validated calculator inputs without accepting a missing booking envelope', () => {
    sessionStorage.setItem('vve_booking', JSON.stringify({ quoteConfig: selection.quoteConfig }));
    expect(readStoredQuoteConfig()).toEqual(selection.quoteConfig);
    expect(readStoredBookingSelection()).toBeNull();
  });
  it.each([
    { service: 'deep', carpetCounts: { bedroom: 2 } },
    { service: 'deep', deepService: 'carpet_upholstery', carpetCounts: { bedroom: '2' } },
    { service: 'window', windowSize: {} },
    { service: 'office', officeHours: -1 },
  ])('rejects malformed legacy calculator data %#', config => {
    sessionStorage.setItem('vve_booking', JSON.stringify({ quoteConfig: config }));
    expect(readStoredQuoteConfig()).toBeNull();
    expect(isBookingSelection({ serviceName: 'Legacy service', price: 120, quoteConfig: config })).toBe(false);
  });
  it('does not let an untrusted route origin create an external or unsupported back link', () => {
    sessionStorage.clear();
    expect(getQuoteOriginHref(false, 'https://example.com')).toBe('/#quote');
    expect(getQuoteOriginHref(false, '/unknown')).toBe('/#quote');
    expect(getQuoteOriginHref(false, '/booking')).toBe('/#quote');
    expect(getQuoteOriginHref(false, '/sofa-cleaning-london')).toBe('/sofa-cleaning-london#quote');
    expect(getQuoteOriginHref(false, '/carpet-cleaning-london/')).toBe('/carpet-cleaning-london#quote');
  });
});
