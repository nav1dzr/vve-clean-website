// Integration: does entering the real app on a campaign URL record attribution
// — and, just as importantly, does it refuse to record anything until the
// visitor has agreed to advertising storage?
//
// Two defects are guarded here, and they pull in opposite directions:
//
//   1. The original defect: capture was only wired to /leaflet, so an ad click
//      landing anywhere else reached the booking form with no campaign data.
//      The unit tests could not catch that — the function was fine, nothing
//      called it. These tests mount the real App and assert the wiring.
//
//   2. The fix for (1) then wrote utm_* and gclid to localStorage on mount,
//      before the cookie banner had been answered. Campaign measurement is not
//      strictly necessary storage, so that needed consent. The tests below
//      assert the gate holds in every consent state, AND that a late "Accept"
//      still records the ORIGINAL entry URL rather than whatever page the
//      visitor happens to be on by then — which is the whole reason the entry
//      is held in memory.
//
// The leaflet discount is the control: it must keep working in every state,
// including outright rejection, because the visitor scanned a QR code asking
// for it.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import {
  ADVERTISING_KEYS,
  getAttribution,
  resetAttributionMemory,
} from './attribution';
import {
  ACCEPT_ALL_CATEGORIES,
  CONSENT_STORAGE_KEY,
  REJECT_OPTIONAL_CATEGORIES,
  saveConsent,
} from './consent';

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
  // The entry snapshot is module state that outlives a render, so it has to be
  // dropped between cases or one test's landing URL leaks into the next.
  resetAttributionMemory();
});

/** Every advertising key currently in localStorage. Should be empty until consent. */
function storedAdvertisingKeys(): string[] {
  return ADVERTISING_KEYS.filter((k) => localStorage.getItem(k) !== null);
}

/** Enters the app at a URL, exactly as a visitor arriving from an ad would. */
function enterAt(url: string) {
  window.history.pushState({}, '', url);
  return render(<App />);
}

/**
 * Reproduces a visitor carrying attribution written by the implementation that
 * ran BEFORE consent was required — the exact population this whole gate
 * exists to protect. Every advertising key is present and none of it was
 * agreed to.
 */
function seedPreConsentAttribution() {
  localStorage.setItem('vve_first_source',  'google');
  localStorage.setItem('vve_last_source',   'google');
  localStorage.setItem('vve_landing_page',  '/carpet-cleaning-london');
  localStorage.setItem('vve_utm_source',    'google');
  localStorage.setItem('vve_utm_medium',    'cpc');
  localStorage.setItem('vve_utm_campaign',  'OLD_CAMPAIGN');
  localStorage.setItem('vve_utm_content',   'old_ad');
  localStorage.setItem('vve_gclid',         'OLD_CLICK_ID');
}

/** Every advertising field, blanked — the shape BookingPage must receive. */
const NO_CAMPAIGN = {
  first_source: null, last_source: null, landing_page: null,
  utm_source: null, utm_medium: null, utm_campaign: null,
  utm_content: null, gclid: null,
};

/** Waits for the consent banner, proving the app has finished settling. */
async function waitForBanner() {
  return screen.findByRole('button', { name: 'Accept all' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Undecided
// ─────────────────────────────────────────────────────────────────────────────

describe('before the visitor has answered the cookie banner', () => {
  it('writes no attribution to localStorage at all', async () => {
    enterAt('/?utm_source=google&utm_medium=cpc&utm_campaign=aug&gclid=click_1');
    await waitForBanner();

    expect(storedAdvertisingKeys()).toEqual([]);
    const a = getAttribution();
    expect(a.utm_source).toBeNull();
    expect(a.gclid).toBeNull();
    expect(a.first_source).toBeNull();
    expect(a.landing_page).toBeNull();
  });

  it('leaves no campaign value anywhere in localStorage, under any key', async () => {
    enterAt('/?utm_source=google&utm_campaign=SECRET_CAMPAIGN&gclid=SECRET_CLICK');
    await waitForBanner();

    const dump = Object.keys(localStorage)
      .map((k) => `${k}=${localStorage.getItem(k)}`)
      .join('|');
    expect(dump).not.toContain('SECRET_CAMPAIGN');
    expect(dump).not.toContain('SECRET_CLICK');
  });

  it('renders no campaign value into the page either', async () => {
    const { container } = enterAt('/?utm_campaign=SECRET_CAMPAIGN&gclid=SECRET_CLICK');
    await waitForBanner();

    expect(container.innerHTML).not.toContain('SECRET_CAMPAIGN');
    expect(document.body.innerHTML).not.toContain('SECRET_CLICK');
  });

  it('transmits nothing', async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.reject(new Error('blocked in test'));
    }) as typeof fetch;

    try {
      enterAt('/?utm_source=google&gclid=click_3');
      await waitForBanner();
      expect(calls.some((u) => u.includes('checkout') || u.includes('booking'))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Attribution already on disk, with no consent to hold it
// ─────────────────────────────────────────────────────────────────────────────

describe('attribution left behind by the pre-consent implementation', () => {
  it('is deleted as soon as the app knows there is no stored choice', async () => {
    // The defect this covers: gating only the WRITE left these keys in place
    // for anyone who had used the site before the gate existed — readable, and
    // still sent at booking. The people whose data was taken without asking
    // would have been the very people it kept being transmitted for.
    seedPreConsentAttribution();
    enterAt('/');
    await waitForBanner();

    await waitFor(() => expect(storedAdvertisingKeys()).toEqual([]));
    expect(getAttribution()).toMatchObject(NO_CAMPAIGN);
  });

  it('is deleted when the stored consent record is from a superseded version', async () => {
    // A policy change bumps CONSENT_VERSION, which invalidates the old record
    // and re-prompts. Until they answer again there is no current permission,
    // so the old attribution cannot be kept on the strength of the old answer.
    seedPreConsentAttribution();
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      analytics: true, advertising: true, choice: 'accepted_all',
      version: '2000-01-01', timestamp: new Date().toISOString(),
    }));

    enterAt('/');
    await waitForBanner();

    await waitFor(() => expect(storedAdvertisingKeys()).toEqual([]));
    expect(getAttribution()).toMatchObject(NO_CAMPAIGN);
  });

  it('is deleted when the stored consent record is corrupt', async () => {
    seedPreConsentAttribution();
    localStorage.setItem(CONSENT_STORAGE_KEY, '{not valid json');

    enterAt('/');
    await waitForBanner();

    await waitFor(() => expect(storedAdvertisingKeys()).toEqual([]));
    expect(getAttribution().gclid).toBeNull();
  });

  it('leaves the leaflet discount alone while clearing the measurement', async () => {
    // The visitor is still owed the 20% they scanned a QR code for.
    seedPreConsentAttribution();
    localStorage.setItem('vve_offer_code', 'LEAFLET20');
    localStorage.setItem('vve_discount_percent', '20');

    enterAt('/');
    await waitForBanner();

    await waitFor(() => expect(storedAdvertisingKeys()).toEqual([]));
    const a = getAttribution();
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);
  });

  it('is kept and updated normally when consent WAS validly given', async () => {
    // The mirror image: a valid, current acceptance must not be treated as
    // suspect. First-touch survives, the newer campaign updates.
    seedPreConsentAttribution();
    saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all');

    enterAt('/?utm_source=bing&utm_campaign=NEW_CAMPAIGN');

    await waitFor(() => expect(getAttribution().utm_campaign).toBe('NEW_CAMPAIGN'));
    expect(getAttribution().first_source).toBe('google');   // write-once, kept
    expect(getAttribution().gclid).toBe('OLD_CLICK_ID');    // write-once, kept
    expect(getAttribution().last_source).toBe('bing');      // updated
  });

  it('writes the CURRENT entry, not the cleared one, if they accept afterwards', async () => {
    // Cleanup must not cost the visit its own attribution: the entry snapshot
    // is in memory and survives the storage wipe.
    seedPreConsentAttribution();
    const user = userEvent.setup();
    enterAt('/sofa-cleaning-london?utm_source=google&utm_campaign=THIS_VISIT&gclid=THIS_CLICK');
    await waitForBanner();

    await waitFor(() => expect(storedAdvertisingKeys()).toEqual([]));
    await user.click(screen.getByRole('button', { name: 'Accept all' }));

    await waitFor(() => expect(getAttribution().gclid).toBe('THIS_CLICK'));
    expect(getAttribution()).toMatchObject({
      first_source: 'google',
      utm_campaign: 'THIS_VISIT',
      landing_page: '/sofa-cleaning-london',
    });
    // The stale campaign is gone for good, not merely hidden.
    expect(getAttribution().utm_content).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('when the visitor rejects optional cookies', () => {
  it('stores no advertising attribution', async () => {
    const user = userEvent.setup();
    enterAt('/?utm_source=google&utm_medium=cpc&gclid=click_2');
    await user.click(await waitForBanner().then(() => screen.getByRole('button', { name: 'Reject optional' })));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject optional' })).toBeNull());
    expect(storedAdvertisingKeys()).toEqual([]);
    expect(getAttribution().gclid).toBeNull();
  });

  it('erases attribution recorded under an earlier acceptance', async () => {
    // A visitor who consented, then changed their mind in Cookie settings, must
    // not leave measurement data behind — withdrawal has to mean something.
    saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all');
    const user = userEvent.setup();
    const { container } = enterAt('/?utm_source=google&gclid=click_persisted');
    await waitFor(() => expect(getAttribution().gclid).toBe('click_persisted'));

    await user.click(screen.getByRole('button', { name: 'Cookie settings' }));
    const advertising = container.querySelector('#consent-advertising') as HTMLButtonElement;
    expect(advertising.getAttribute('aria-checked')).toBe('true');
    await user.click(advertising);
    await user.click(screen.getByRole('button', { name: 'Save choices' }));

    await waitFor(() => expect(storedAdvertisingKeys()).toEqual([]));
    expect(getAttribution().utm_source).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accepted
// ─────────────────────────────────────────────────────────────────────────────

describe('when the visitor accepts advertising', () => {
  it('stores the campaign it was entered on', async () => {
    const user = userEvent.setup();
    enterAt('/?utm_source=google&utm_medium=cpc&utm_campaign=aug_carpet&utm_content=v2&gclid=click_1');
    await user.click(await waitForBanner());

    await waitFor(() => expect(getAttribution().gclid).toBe('click_1'));
    expect(getAttribution()).toMatchObject({
      first_source: 'google',
      last_source: 'google',
      landing_page: '/',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'aug_carpet',
      utm_content: 'v2',
      gclid: 'click_1',
    });
  });

  it('captures on a service landing page, the case that was previously lost', async () => {
    const user = userEvent.setup();
    enterAt('/carpet-cleaning-london?utm_source=google&gclid=click_2');
    await user.click(await waitForBanner());

    await waitFor(() => expect(getAttribution().gclid).toBe('click_2'));
    expect(getAttribution().first_source).toBe('google');
    expect(getAttribution().landing_page).toBe('/carpet-cleaning-london');
  });

  it('records an organic entry as direct, without inventing a campaign', async () => {
    const user = userEvent.setup();
    enterAt('/pricing');
    await user.click(await waitForBanner());

    await waitFor(() => expect(getAttribution().first_source).toBe('direct'));
    expect(getAttribution().utm_source).toBeNull();
    expect(getAttribution().gclid).toBeNull();
  });

  it('needs no click at all when consent was given on a previous visit', async () => {
    saveConsent(ACCEPT_ALL_CATEGORIES, 'accepted_all');
    enterAt('/?utm_source=google&gclid=returning_click');

    await waitFor(() => expect(getAttribution().gclid).toBe('returning_click'));
    // No banner to answer — the stored choice already covers it.
    expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull();
  });

  it('stores nothing the API would reject', async () => {
    const user = userEvent.setup();
    enterAt('/?utm_term=should_be_ignored&utm_source=google');
    await user.click(await waitForBanner());

    await waitFor(() => expect(getAttribution().utm_source).toBe('google'));
    expect(Object.keys(localStorage).some((k) => k.includes('utm_term'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Consent granted late — the reason the entry is held in memory
// ─────────────────────────────────────────────────────────────────────────────

describe('when advertising is enabled later in the same visit', () => {
  it('still records the ORIGINAL entry URL, not the page they are on now', async () => {
    const user = userEvent.setup();
    enterAt('/?utm_source=google&utm_campaign=aug_carpet&gclid=original_click');
    await waitForBanner();

    // The visitor browses on. The ad's query string is gone from the address
    // bar; only the in-memory snapshot still knows how they arrived.
    window.history.pushState({}, '', '/pricing');
    expect(storedAdvertisingKeys()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Accept all' }));

    await waitFor(() => expect(getAttribution().gclid).toBe('original_click'));
    expect(getAttribution().utm_campaign).toBe('aug_carpet');
    expect(getAttribution().landing_page).toBe('/');
  });

  it('works when advertising is switched on through Cookie settings', async () => {
    // Reject first, browse, then change their mind via the footer link — the
    // path a visitor takes when they decide the banner was too aggressive.
    saveConsent(REJECT_OPTIONAL_CATEGORIES, 'rejected_optional');
    const user = userEvent.setup();
    const { container } = enterAt('/?utm_source=google&gclid=late_click');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeTruthy());
    expect(storedAdvertisingKeys()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Cookie settings' }));
    const advertising = container.querySelector('#consent-advertising') as HTMLButtonElement;
    expect(advertising.getAttribute('aria-checked')).toBe('false');
    await user.click(advertising);
    await user.click(screen.getByRole('button', { name: 'Save choices' }));

    await waitFor(() => expect(getAttribution().gclid).toBe('late_click'));
    expect(getAttribution().first_source).toBe('google');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The leaflet discount must survive every one of the above
// ─────────────────────────────────────────────────────────────────────────────

describe('the leaflet discount is not advertising storage', () => {
  it('applies while the banner is still unanswered', async () => {
    enterAt('/leaflet');
    await waitForBanner();

    const a = getAttribution();
    expect(a.offer_code).toBe('LEAFLET20');
    expect(a.discount_percent).toBe(20);
    // …and it dragged no measurement in with it.
    expect(storedAdvertisingKeys()).toEqual([]);
  });

  it('survives an outright rejection', async () => {
    const user = userEvent.setup();
    enterAt('/leaflet');
    await waitForBanner();
    await user.click(screen.getByRole('button', { name: 'Reject optional' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject optional' })).toBeNull());
    expect(getAttribution().offer_code).toBe('LEAFLET20');
    expect(getAttribution().discount_percent).toBe(20);
    expect(storedAdvertisingKeys()).toEqual([]);
  });

  it('shows the 20% offer on the page regardless of the cookie choice', async () => {
    const user = userEvent.setup();
    enterAt('/leaflet');
    await user.click(await waitForBanner().then(() => screen.getByRole('button', { name: 'Reject optional' })));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject optional' })).toBeNull());
    expect(document.body.textContent).toMatch(/20%/);
  });

  it('adds the leaflet source only once advertising is accepted', async () => {
    const user = userEvent.setup();
    enterAt('/leaflet');
    await user.click(await waitForBanner());

    await waitFor(() => expect(getAttribution().first_source).toBe('leaflet'));
    expect(getAttribution().utm_campaign).toBe('leaflet20');
    expect(getAttribution().offer_code).toBe('LEAFLET20');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Booking
// ─────────────────────────────────────────────────────────────────────────────

describe('the booking submission still works either way', () => {
  it('carries the full campaign payload when consent was given', async () => {
    const user = userEvent.setup();
    enterAt('/?utm_source=google&utm_medium=cpc&utm_campaign=aug&utm_content=v2&gclid=cid');
    await user.click(await waitForBanner());

    // BookingPage builds its payload from getAttribution() (see the
    // "// Attribution" block in handleSubmit). These are the five campaign
    // fields api/create-checkout-session.js accepts, plus the three
    // source/landing fields.
    await waitFor(() => expect(getAttribution().gclid).toBe('cid'));
    expect(getAttribution()).toMatchObject({
      first_source: 'google', last_source: 'google', landing_page: '/',
      utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'aug',
      utm_content: 'v2', gclid: 'cid',
    });
  });

  it('sends an all-null campaign payload rather than failing when consent was refused', async () => {
    // The booking must submit normally; it simply carries no measurement. This
    // is the shape BookingPage will read, so nulls must be safe.
    const user = userEvent.setup();
    enterAt('/?utm_source=google&gclid=cid');
    await user.click(await waitForBanner().then(() => screen.getByRole('button', { name: 'Reject optional' })));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject optional' })).toBeNull());
    const a = getAttribution();
    expect(a).toMatchObject({
      first_source: null, last_source: null, landing_page: null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_content: null, gclid: null,
    });
    expect(() => JSON.stringify(a)).not.toThrow();
  });

  it('keeps the booking page reachable with advertising refused', async () => {
    const user = userEvent.setup();
    enterAt('/booking');
    await user.click(await waitForBanner().then(() => screen.getByRole('button', { name: 'Reject optional' })));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject optional' })).toBeNull());
    expect(document.body.textContent).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Something went wrong/i);
  });
});
