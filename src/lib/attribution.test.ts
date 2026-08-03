// Campaign attribution capture.
//
// Capture previously happened on /leaflet only, so a Google Ads click landing
// on the homepage or a service page reached the booking form with no gclid and
// no utm_*, and the spend could not be tied to revenue in the CRM.
//
// The subtle requirements are the ones worth pinning: first-touch must not be
// overwritten, an internal navigation must not clobber a real campaign source
// with "direct", and gclid must stay write-once because it decides which click
// Google credits for the conversion.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAttribution, getAttribution, setLeafletAttribution } from './attribution';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('capturing a campaign click on any route', () => {
  it('records the full utm set and gclid from the landing URL', () => {
    captureAttribution(
      '?utm_source=google&utm_medium=cpc&utm_campaign=carpet_aug&utm_content=ad_a&gclid=abc123',
      '/carpet-cleaning-london',
    );

    const a = getAttribution();
    expect(a.utm_source).toBe('google');
    expect(a.utm_medium).toBe('cpc');
    expect(a.utm_campaign).toBe('carpet_aug');
    expect(a.utm_content).toBe('ad_a');
    expect(a.gclid).toBe('abc123');
    expect(a.first_source).toBe('google');
    expect(a.last_source).toBe('google');
    expect(a.landing_page).toBe('/carpet-cleaning-london');
  });

  it('works from the homepage, which previously captured nothing', () => {
    captureAttribution('?utm_source=facebook&utm_medium=social', '/');
    expect(getAttribution().utm_source).toBe('facebook');
    expect(getAttribution().landing_page).toBe('/');
  });

  it('names a bare gclid as a paid click rather than leaving it organic', () => {
    captureAttribution('?gclid=xyz789', '/sofa-cleaning-london');

    const a = getAttribution();
    expect(a.gclid).toBe('xyz789');
    expect(a.first_source).toBe('google-ads');
    expect(a.last_source).toBe('google-ads');
  });

  it('records an organic entry as direct', () => {
    captureAttribution('', '/pricing');

    const a = getAttribution();
    expect(a.first_source).toBe('direct');
    expect(a.landing_page).toBe('/pricing');
    expect(a.utm_source).toBeNull();
  });

  it('truncates to the 500 chars the API accepts', () => {
    captureAttribution(`?utm_campaign=${'x'.repeat(900)}`, '/');
    expect(getAttribution().utm_campaign).toHaveLength(500);
  });

  it('ignores blank parameter values', () => {
    captureAttribution('?utm_source=&utm_medium=%20&gclid=', '/');

    const a = getAttribution();
    expect(a.utm_source).toBeNull();
    expect(a.utm_medium).toBeNull();
    expect(a.gclid).toBeNull();
    expect(a.first_source).toBe('direct');
  });
});

describe('first touch is not overwritten', () => {
  it('keeps the original first_source and landing_page across later visits', () => {
    captureAttribution('?utm_source=leaflet_qr', '/leaflet');
    captureAttribution('?utm_source=google&utm_medium=cpc', '/carpet-cleaning-london');

    const a = getAttribution();
    expect(a.first_source).toBe('leaflet_qr');      // unchanged
    expect(a.landing_page).toBe('/leaflet');        // unchanged
    expect(a.last_source).toBe('google');           // updated
    expect(a.utm_source).toBe('google');            // updated
  });

  it('keeps a real first_source when a later visit is organic', () => {
    captureAttribution('?utm_source=google', '/');
    captureAttribution('', '/pricing');
    expect(getAttribution().first_source).toBe('google');
  });
});

describe('internal navigation cannot clobber a campaign source', () => {
  it('leaves last_source and utm_* alone when the URL has no campaign params', () => {
    captureAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=aug', '/');

    // Simulates a reload or second entry on a page with no query string.
    captureAttribution('', '/gallery');

    const a = getAttribution();
    expect(a.last_source).toBe('google');
    expect(a.utm_source).toBe('google');
    expect(a.utm_medium).toBe('cpc');
    expect(a.utm_campaign).toBe('aug');
  });

  it('survives navigating between pages and is still readable at booking', () => {
    captureAttribution('?utm_source=google&gclid=click1', '/carpet-cleaning-london');
    captureAttribution('', '/pricing');
    captureAttribution('', '/booking');

    const a = getAttribution();
    expect(a.utm_source).toBe('google');
    expect(a.gclid).toBe('click1');
  });
});

describe('gclid is write-once', () => {
  it('does not replace an existing click id', () => {
    // Overwriting would change which click Google credits for the conversion.
    captureAttribution('?gclid=first_click', '/');
    captureAttribution('?gclid=second_click', '/pricing');
    expect(getAttribution().gclid).toBe('first_click');
  });

  it('still updates the utm set on the newer click', () => {
    captureAttribution('?gclid=first_click&utm_campaign=old', '/');
    captureAttribution('?gclid=second_click&utm_campaign=new', '/');

    const a = getAttribution();
    expect(a.gclid).toBe('first_click');
    expect(a.utm_campaign).toBe('new');
  });
});

describe('the leaflet flow is unchanged', () => {
  it('still records its own offer, discount and source', () => {
    setLeafletAttribution();

    const a = getAttribution();
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);
    expect(a.first_source).toBe('leaflet');
    expect(a.utm_campaign).toBe('leaflet20');
  });

  it('is not disturbed by a later generic capture with no params', () => {
    setLeafletAttribution();
    captureAttribution('', '/leaflet');

    const a = getAttribution();
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);
    expect(a.utm_source).toBe('leaflet');
  });
});

describe('it never breaks the page', () => {
  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => captureAttribution('?utm_source=google', '/')).not.toThrow();
  });

  it('returns an all-null shape when storage is unreadable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const a = getAttribution();
    expect(a.utm_source).toBeNull();
    expect(a.gclid).toBeNull();
  });
});

describe('only fields the backend actually accepts are captured', () => {
  it('does not capture utm_term', () => {
    // utm_term is absent from api/create-checkout-session.js, the webhook, the
    // CRM allow-list and the bookings row mapping. Capturing it would imply a
    // coverage that does not exist — it would be dropped at the API boundary.
    captureAttribution('?utm_term=carpet+cleaning+london&utm_source=google', '/');

    const stored = Object.keys(localStorage);
    expect(stored.some((k) => k.includes('utm_term'))).toBe(false);
    expect(getAttribution()).not.toHaveProperty('utm_term');
  });
});
