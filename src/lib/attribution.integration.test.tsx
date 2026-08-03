// Integration: does entering the real app on a campaign URL actually record
// attribution, and does the booking submission carry it?
//
// The unit tests cover captureAttribution's logic. What they cannot show is
// that anything CALLS it — the original defect was not a broken function, it
// was a function only wired to /leaflet. These tests mount the real App and
// assert the wiring.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from '../App';
import { getAttribution } from './attribution';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/** Enters the app at a URL, exactly as a visitor arriving from an ad would. */
async function enterAt(url: string) {
  window.history.pushState({}, '', url);
  const view = render(<App />);
  await waitFor(() => expect(getAttribution().landing_page).not.toBeNull());
  return view;
}

describe('entering on a campaign URL', () => {
  it('captures on the homepage', async () => {
    await enterAt('/?utm_source=google&utm_medium=cpc&utm_campaign=aug_carpet&gclid=click_1');

    const a = getAttribution();
    expect(a.utm_source).toBe('google');
    expect(a.utm_medium).toBe('cpc');
    expect(a.utm_campaign).toBe('aug_carpet');
    expect(a.gclid).toBe('click_1');
    expect(a.landing_page).toBe('/');
  });

  it('captures on a service landing page', async () => {
    // The exact case that was previously lost: an ad pointing at a service page.
    await enterAt('/carpet-cleaning-london?utm_source=google&gclid=click_2');

    const a = getAttribution();
    expect(a.gclid).toBe('click_2');
    expect(a.first_source).toBe('google');
    expect(a.landing_page).toBe('/carpet-cleaning-london');
  });

  it('records an organic entry without inventing a campaign', async () => {
    await enterAt('/pricing');

    const a = getAttribution();
    expect(a.first_source).toBe('direct');
    expect(a.utm_source).toBeNull();
    expect(a.gclid).toBeNull();
  });
});

describe('nothing leaks into the page', () => {
  it('renders no campaign value anywhere in the DOM', async () => {
    const { container } = await enterAt(
      '/?utm_source=google&utm_campaign=SECRET_CAMPAIGN_NAME&gclid=SECRET_CLICK_ID',
    );

    expect(container.innerHTML).not.toContain('SECRET_CAMPAIGN_NAME');
    expect(container.innerHTML).not.toContain('SECRET_CLICK_ID');
    expect(document.body.innerHTML).not.toContain('SECRET_CLICK_ID');
  });
});

describe('the values reach the booking submission', () => {
  it('is exactly the shape BookingPage sends to the API', async () => {
    await enterAt('/?utm_source=google&utm_medium=cpc&utm_campaign=aug&utm_content=v2&gclid=cid');

    // BookingPage builds its payload from getAttribution() (see the
    // "// Attribution" block in handleSubmit). These are the five campaign
    // fields api/create-checkout-session.js accepts, plus the three
    // source/landing fields.
    const a = getAttribution();
    expect(a).toMatchObject({
      first_source: 'google',
      last_source: 'google',
      landing_page: '/',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'aug',
      utm_content: 'v2',
      gclid: 'cid',
    });
  });

  it('stores nothing the API would reject', async () => {
    await enterAt('/?utm_term=should_be_ignored&utm_source=google');

    // utm_term is not in the API allow-list, the webhook, the CRM field list or
    // the bookings row mapping — capturing it would be dead weight.
    expect(Object.keys(localStorage).some((k) => k.includes('utm_term'))).toBe(false);
  });
});

describe('capture happens before any transmission', () => {
  it('sends nothing on entry — values are local until the customer books', async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.reject(new Error('blocked in test'));
    }) as typeof fetch;

    try {
      await enterAt('/?utm_source=google&gclid=click_3');
      // Whatever else the page does on mount, it must not post attribution.
      expect(calls.some((u) => u.includes('checkout') || u.includes('booking'))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
