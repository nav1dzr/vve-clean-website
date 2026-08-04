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

describe('capturing a campaign click on any route', () => {
  it('records the full utm set and gclid from the landing URL', () => {
    writeAdvertisingAttribution(
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
    expect(a.utm_source).toBe('google');            // updated
  });

  it('keeps a real first_source when a later visit is organic', () => {
    writeAdvertisingAttribution('?utm_source=google', '/');
    writeAdvertisingAttribution('', '/pricing');
    expect(getAttribution().first_source).toBe('google');
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

describe('gclid is write-once', () => {
  it('does not replace an existing click id', () => {
    // Overwriting would change which click Google credits for the conversion.
    writeAdvertisingAttribution('?gclid=first_click', '/');
    writeAdvertisingAttribution('?gclid=second_click', '/pricing');
    expect(getAttribution().gclid).toBe('first_click');
  });

  it('still updates the utm set on the newer click', () => {
    writeAdvertisingAttribution('?gclid=first_click&utm_campaign=old', '/');
    writeAdvertisingAttribution('?gclid=second_click&utm_campaign=new', '/');

    const a = getAttribution();
    expect(a.gclid).toBe('first_click');
    expect(a.utm_campaign).toBe('new');
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
      first_source: null, last_source: null, landing_page: null,
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

    setAdvertisingConsent(false);

    for (const key of ADVERTISING_KEYS) {
      expect(localStorage.getItem(key), `${key} must be deleted`).toBeNull();
    }
    expect(localStorage.getItem('vve_offer_code')).toBe('LEAFLET20');
    expect(localStorage.getItem('vve_discount_percent')).toBe('20');
  });
});

describe('only fields the backend actually accepts are captured', () => {
  it('does not capture utm_term', () => {
    // utm_term is absent from api/create-checkout-session.js, the webhook, the
    // CRM allow-list and the bookings row mapping. Capturing it would imply a
    // coverage that does not exist — it would be dropped at the API boundary.
    writeAdvertisingAttribution('?utm_term=carpet+cleaning+london&utm_source=google', '/');

    const stored = Object.keys(localStorage);
    expect(stored.some((k) => k.includes('utm_term'))).toBe(false);
    expect(getAttribution()).not.toHaveProperty('utm_term');
  });
});
