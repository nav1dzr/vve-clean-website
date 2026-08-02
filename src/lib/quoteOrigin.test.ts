// "Back to quote" used to be hard-coded to '/#quote', so a customer who built
// a quote on the Carpet or Sofa page was returned to the homepage calculator.
// These pin the route bookkeeping that fixes it.

import { beforeEach, describe, expect, it } from 'vitest';
import { clearQuoteOrigin, getQuoteOriginHref, rememberQuoteOrigin } from './quoteOrigin';

beforeEach(() => sessionStorage.clear());

describe('rememberQuoteOrigin', () => {
  it.each([
    ['/carpet-cleaning-london', '/carpet-cleaning-london#quote'],
    ['/sofa-cleaning-london', '/sofa-cleaning-london#quote'],
    ['/end-of-tenancy-cleaning-london', '/end-of-tenancy-cleaning-london#quote'],
    ['/after-builders-cleaning-london', '/after-builders-cleaning-london#quote'],
    ['/commercial-carpet-cleaning-london', '/commercial-carpet-cleaning-london#quote'],
    ['/leaflet', '/leaflet#quote'],
    ['/', '/#quote'],
  ])('records %s and returns %s', (path, expected) => {
    rememberQuoteOrigin(path);
    expect(getQuoteOriginHref()).toBe(expected);
  });

  it('normalises a trailing slash', () => {
    rememberQuoteOrigin('/carpet-cleaning-london/');
    expect(getQuoteOriginHref()).toBe('/carpet-cleaning-london#quote');
  });

  it('ignores a route that is not a quote page, rather than sending the customer there', () => {
    rememberQuoteOrigin('/privacy-policy');
    expect(getQuoteOriginHref()).toBe('/#quote');
  });

  it('ignores an off-site or malformed path', () => {
    rememberQuoteOrigin('https://evil.example/#quote');
    rememberQuoteOrigin('/../booking');
    expect(getQuoteOriginHref()).toBe('/#quote');
  });
});

describe('getQuoteOriginHref fallbacks', () => {
  it('falls back to the homepage quote when nothing was recorded', () => {
    expect(getQuoteOriginHref()).toBe('/#quote');
  });

  it('keeps the leaflet special case for a booking restored in a fresh tab', () => {
    expect(getQuoteOriginHref(true)).toBe('/leaflet#quote');
  });

  it('prefers a recorded origin over the leaflet fallback', () => {
    rememberQuoteOrigin('/sofa-cleaning-london');
    expect(getQuoteOriginHref(true)).toBe('/sofa-cleaning-london#quote');
  });

  it('never returns /booking — that is where the link already is', () => {
    rememberQuoteOrigin('/booking');
    expect(getQuoteOriginHref()).toBe('/#quote');
  });

  it('ignores a hand-edited value', () => {
    sessionStorage.setItem('vve_quote_origin', '/not-a-route');
    expect(getQuoteOriginHref()).toBe('/#quote');
  });
});

describe('clearQuoteOrigin', () => {
  it('forgets the recorded origin', () => {
    rememberQuoteOrigin('/carpet-cleaning-london');
    clearQuoteOrigin();
    expect(getQuoteOriginHref()).toBe('/#quote');
  });
});
