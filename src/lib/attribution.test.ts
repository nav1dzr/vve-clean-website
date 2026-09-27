// Campaign attribution capture.
//
// Capture previously happened on /leaflet only, so a Google Ads click landing
// on the homepage or a service page reached the booking form with no gclid and
// no utm_*, and the spend could not be tied to revenue in the CRM.
//
// The subtle requirements are the ones worth pinning: first-touch must not be
// overwritten, an internal navigation must not clobber a real campaign source
// with "direct", and the retention clock must remain tied to the first touch
// together with the original campaign and click identifiers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVERTISING_KEYS,
  getAttribution,
  resetAttributionMemory,
  setAdvertisingConsent,
  setLeafletOffer,
  writeAdvertisingAttribution,
  writeLeafletAttribution,
} from './attribution';

// These tests exercise the STORAGE RULES in isolation, so they call the writer
// directly and grant consent up front. Whether the writer is allowed to run at
// all is the consent gate, a separate concern covered end-to-end in
// attribution.integration.test.tsx — except for the read-side gate, which is
// pinned directly in the last describe block below.
beforeEach(() => {
  localStorage.clear();
  resetAttributionMemory();
  setAdvertisingConsent(true);
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('capturing a campaign click on any route', () => {
  it('records the full approved utm set and Google click identifiers', () => {
    writeAdvertisingAttribution(
      '?utm_source=google&utm_medium=cpc&utm_campaign=carpet_aug&utm_content=ad_a&utm_term=carpet&gclid=abc123&gbraid=braid1&wbraid=braid2',
      '/carpet-cleaning-london',
    );

    const a = getAttribution();
    expect(a.utm_source).toBe('google');
    expect(a.utm_medium).toBe('cpc');
    expect(a.utm_campaign).toBe('carpet_aug');
    expect(a.utm_content).toBe('ad_a');
    expect(a.utm_term).toBe('carpet');
    expect(a.gclid).toBe('abc123');
    expect(a.gbraid).toBe('braid1');
    expect(a.wbraid).toBe('braid2');
    expect(a.first_source).toBe('google');
    expect(a.last_source).toBe('google');
    expect(a.landing_page).toBe('/carpet-cleaning-london');
  });

  it('works from the homepage, which previously captured nothing', () => {
    writeAdvertisingAttribution('?utm_source=facebook&utm_medium=social', '/');
    expect(getAttribution().utm_source).toBe('facebook');
    expect(getAttribution().landing_page).toBe('/');
  });

  it('names a bare gclid as a paid click rather than leaving it organic', () => {
    writeAdvertisingAttribution('?gclid=xyz789', '/sofa-cleaning-london');

    const a = getAttribution();
    expect(a.gclid).toBe('xyz789');
    expect(a.first_source).toBe('google-ads');
    expect(a.last_source).toBe('google-ads');
  });

  it.each([
    ['gbraid', 'ios-app-click'],
    ['wbraid', 'ios-web-click'],
  ])('names a bare %s as a paid click rather than direct', (field, value) => {
    writeAdvertisingAttribution(`?${field}=${value}`, '/carpet-cleaning-london');

    const a = getAttribution();
    expect(a[field as 'gbraid' | 'wbraid']).toBe(value);
    expect(a.first_source).toBe('google-ads');
    expect(a.last_source).toBe('google-ads');
  });

  it('records an organic entry as direct', () => {
    writeAdvertisingAttribution('', '/pricing');

    const a = getAttribution();
    expect(a.first_source).toBe('direct');
    expect(a.landing_page).toBe('/pricing');
    expect(a.utm_source).toBeNull();
  });

  it('truncates to the 500 chars the API accepts', () => {
    writeAdvertisingAttribution(`?utm_campaign=${'x'.repeat(900)}`, '/');
    expect(getAttribution().utm_campaign).toHaveLength(500);
  });

  it('ignores blank parameter values', () => {
    writeAdvertisingAttribution('?utm_source=&utm_medium=%20&gclid=', '/');

    const a = getAttribution();
    expect(a.utm_source).toBeNull();
    expect(a.utm_medium).toBeNull();
    expect(a.gclid).toBeNull();
    expect(a.first_source).toBe('direct');
  });
});

describe('first touch is not overwritten', () => {
  it('keeps the original first_source and landing_page across later visits', () => {
    writeAdvertisingAttribution('?utm_source=leaflet_qr', '/leaflet');
    writeAdvertisingAttribution('?utm_source=google&utm_medium=cpc', '/carpet-cleaning-london');

    const a = getAttribution();
    expect(a.first_source).toBe('leaflet_qr');      // unchanged
    expect(a.landing_page).toBe('/leaflet');        // unchanged
    expect(a.last_source).toBe('google');           // updated
    expect(a.utm_source).toBe('leaflet_qr');        // original campaign retained
  });

  it('keeps a real first_source when a later visit is organic', () => {
    writeAdvertisingAttribution('?utm_source=google', '/');
    writeAdvertisingAttribution('', '/pricing');
    expect(getAttribution().first_source).toBe('google');
  });

  it('keeps the original timestamp and expires from it rather than a later campaign', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    writeAdvertisingAttribution('?utm_source=google&gclid=first', '/');
    expect(getAttribution().first_touch_at).toBe('2026-01-01T12:00:00.000Z');

    vi.setSystemTime(new Date('2026-01-30T12:00:00.000Z'));
    writeAdvertisingAttribution('?utm_source=google&gclid=later', '/pricing');
    expect(getAttribution().first_touch_at).toBe('2026-01-01T12:00:00.000Z');
    expect(getAttribution().gclid).toBe('first');

    vi.setSystemTime(new Date('2026-02-01T12:00:00.001Z'));
    expect(getAttribution().first_touch_at).toBeNull();
    expect(getAttribution().gclid).toBeNull();
  });

  it('adopts the previous timestamp key once without restarting the clock', () => {
    localStorage.setItem('vve_attribution_captured_at', '2026-01-10T09:30:00.000Z');
    localStorage.setItem('vve_first_source', 'google');
    localStorage.setItem('vve_landing_page', '/carpet-cleaning-london');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-20T09:30:00.000Z'));

    writeAdvertisingAttribution('?utm_source=google&gclid=newer', '/pricing');

    expect(getAttribution().first_touch_at).toBe('2026-01-10T09:30:00.000Z');
    expect(localStorage.getItem('vve_attribution_captured_at')).toBeNull();
  });
});

describe('internal navigation cannot clobber a campaign source', () => {
  it('leaves last_source and utm_* alone when the URL has no campaign params', () => {
    writeAdvertisingAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=aug', '/');

    // Simulates a reload or second entry on a page with no query string.
    writeAdvertisingAttribution('', '/gallery');

    const a = getAttribution();
    expect(a.last_source).toBe('google');
    expect(a.utm_source).toBe('google');
    expect(a.utm_medium).toBe('cpc');
    expect(a.utm_campaign).toBe('aug');
  });

  it('survives navigating between pages and is still readable at booking', () => {
    writeAdvertisingAttribution('?utm_source=google&gclid=click1', '/carpet-cleaning-london');
    writeAdvertisingAttribution('', '/pricing');
    writeAdvertisingAttribution('', '/booking');

    const a = getAttribution();
    expect(a.utm_source).toBe('google');
    expect(a.gclid).toBe('click1');
  });
});

describe('click attribution belongs to the first visit', () => {
  it('keeps the original paid click identifier', () => {
    writeAdvertisingAttribution('?gclid=first_click', '/');
    writeAdvertisingAttribution('?gclid=second_click', '/pricing');
    expect(getAttribution().gclid).toBe('first_click');
    expect(getAttribution().last_source).toBe('google-ads');
  });

  it('keeps the original campaign fields with the original click', () => {
    writeAdvertisingAttribution('?gclid=first_click&utm_campaign=old', '/');
    writeAdvertisingAttribution('?gclid=second_click&utm_campaign=new', '/');

    const a = getAttribution();
    expect(a.gclid).toBe('first_click');
    expect(a.utm_campaign).toBe('old');
  });
});

describe('the leaflet offer is separated from leaflet measurement', () => {
  it('writes the discount on its own, with no advertising keys at all', () => {
    // The visitor scanned a QR code promising 20% off. Honouring that is what
    // they asked for, so it is written whatever they say to the cookie banner —
    // and it must drag nothing else in with it.
    setLeafletOffer();

    const a = getAttribution();
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);

    for (const key of ADVERTISING_KEYS) {
      expect(localStorage.getItem(key), `${key} must not be written by the offer`).toBeNull();
    }
    expect(a.first_source).toBeNull();
    expect(a.utm_source).toBeNull();
  });

  it('records the leaflet source only through the gated writer', () => {
    writeLeafletAttribution();

    const a = getAttribution();
    expect(a.first_source).toBe('leaflet');
    expect(a.last_source).toBe('leaflet');
    expect(a.landing_page).toBe('/leaflet');
    expect(a.utm_campaign).toBe('leaflet20');
  });

  it('produces the same combined result as before once both have run', () => {
    // Parity check against the original single setLeafletAttribution().
    setLeafletOffer();
    writeLeafletAttribution();
    writeAdvertisingAttribution('', '/leaflet');

    const a = getAttribution();
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);
    expect(a.first_source).toBe('leaflet');
    expect(a.utm_source).toBe('leaflet');
    expect(a.utm_medium).toBe('qr');
    expect(a.utm_campaign).toBe('leaflet20');
  });
});

describe('it never breaks the page', () => {
  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => writeAdvertisingAttribution('?utm_source=google', '/')).not.toThrow();
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

describe('reading is gated as well as writing', () => {
  it('returns no advertising fields when consent is not held, even if storage has them', () => {
    // The case this exists for: a visitor carrying keys written by the
    // pre-consent implementation. Clearing them is the first line of defence,
    // but clearing can fail — storage throwing, a stale key from an older
    // cached build, another tab racing us. getAttribution is the last thing
    // between storage and the network, so it must not read them either.
    writeAdvertisingAttribution('?utm_source=google&utm_campaign=aug&gclid=leftover', '/');
    setLeafletOffer();
    expect(localStorage.getItem('vve_gclid')).toBe('leftover'); // still on disk

    resetAttributionMemory(); // consent flag back to false

    const a = getAttribution();
    expect(a).toMatchObject({
      first_source: null, last_source: null, landing_page: null, first_touch_at: null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_content: null, gclid: null,
    });
    // …but the discount the visitor asked for still comes through.
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);
  });

  it('fails closed: the flag starts false, so a caller that runs too early sends nothing', () => {
    // resetAttributionMemory() reproduces module load. Nothing has told us the
    // visitor's choice yet, so the honest answer is "no permission".
    writeAdvertisingAttribution('?gclid=early', '/');
    resetAttributionMemory();
    expect(getAttribution().gclid).toBeNull();
  });

  it('returns them again once consent is granted', () => {
    writeAdvertisingAttribution('?utm_source=google&gclid=kept', '/');
    resetAttributionMemory();
    expect(getAttribution().gclid).toBeNull();

    setAdvertisingConsent(true);
    expect(getAttribution().gclid).toBe('kept');
    expect(getAttribution().utm_source).toBe('google');
  });

  it('deletes every advertising key when consent is refused, keeping the offer', () => {
    writeAdvertisingAttribution('?utm_source=google&gclid=gone', '/');
    setLeafletOffer();
    sessionStorage.setItem('vve_measured_request_test', '1');
    sessionStorage.setItem('vve_retry_contact', 'essential retry key');

    setAdvertisingConsent(false);

    for (const key of ADVERTISING_KEYS) {
      expect(localStorage.getItem(key), `${key} must be deleted`).toBeNull();
    }
    expect(localStorage.getItem('vve_offer_code')).toBe('LEAFLET20');
    expect(localStorage.getItem('vve_discount_percent')).toBe('20');
    expect(sessionStorage.getItem('vve_measured_request_test')).toBeNull();
    expect(sessionStorage.getItem('vve_retry_contact')).toBe('essential retry key');
  });
  it('does not store private route variants or query values in the landing-page field', () => {
    for (const path of ['/Manage-Booking', '/%6danage-booking/']) {
      writeAdvertisingAttribution('?gclid=private', path);
      expect(localStorage.getItem('vve_gclid')).toBeNull();
    }
    writeAdvertisingAttribution('?utm_source=google', '/carpet-cleaning-london?token=private');
    expect(localStorage.getItem('vve_landing_page')).toBe('/carpet-cleaning-london');
  });
});

describe('all approved fields accepted by the booking backend are captured', () => {
  it('captures utm_term for the server-side payment join', () => {
    writeAdvertisingAttribution('?utm_term=carpet+cleaning+london&utm_source=google', '/');

    const stored = Object.keys(localStorage);
    expect(stored.some((k) => k.includes('utm_term'))).toBe(true);
    expect(getAttribution().utm_term).toBe('carpet cleaning london');
  });
});
