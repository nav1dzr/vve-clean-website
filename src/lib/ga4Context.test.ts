import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGa4BookingContext } from './ga4Context';
import { CONSENT_STORAGE_KEY } from './consent';
import { CONSENT_VERSION } from './consentVersion';

function consent(analytics = true, advertising = false) {
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
    analytics, advertising, version: CONSENT_VERSION,
    timestamp: new Date().toISOString(), choice: 'custom',
  }));
}

describe('consented optional GA4 booking identity', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/booking');
    vi.stubEnv('VITE_GA4_BOOKING_MEASUREMENT_ENABLED', 'true');
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123');
    consent();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

  function tag(client: unknown = '123.456', session: unknown = '789') {
    const gtag = vi.fn((_action, _id, field, callback) => callback(field === 'client_id' ? client : session));
    vi.stubGlobal('gtag', gtag);
    return gtag;
  }

  it('reads actual tag IDs with analytics-only consent without tracking or storing PII', async () => {
    const gtag = tag();
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const result = await getGa4BookingContext();
    expect(result).toMatchObject({ measurement_id: 'G-TEST123', client_id: '123.456', session_id: '789', analytics: true, advertising: false, consent_version: CONSENT_VERSION });
    expect(Object.keys(result!).sort()).toEqual(['advertising','analytics','captured_at','client_id','consent_recorded_at','consent_version','measurement_id','session_id']);
    expect(gtag.mock.calls.every(args => args[0] === 'get')).toBe(true);
    expect(set).not.toHaveBeenCalled();
  });
  it.each([false, true])('does not capture without analytics consent (advertising=%s)', async advertising => {
    consent(false, advertising); const gtag = tag();
    expect(await getGa4BookingContext()).toBeNull(); expect(gtag).not.toHaveBeenCalled();
  });
  it('defaults off independently of a configured Google tag', async () => {
    vi.stubEnv('VITE_GA4_BOOKING_MEASUREMENT_ENABLED', ''); const gtag = tag();
    expect(await getGa4BookingContext()).toBeNull(); expect(gtag).not.toHaveBeenCalled();
  });
  it('never invokes tags on a private booking page', async () => {
    window.history.replaceState({}, '', '/manage-booking'); const gtag = tag();
    expect(await getGa4BookingContext()).toBeNull(); expect(gtag).not.toHaveBeenCalled();
  });
  it.each(['', 'AW-123', 'G-invalid@email.test'])('fails closed for invalid destination %s', async id => {
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', id); const gtag = tag();
    expect(await getGa4BookingContext()).toBeNull(); expect(gtag).not.toHaveBeenCalled();
  });
  it.each([undefined, 'person@example.test', 'WC1N1LX140926', {}, 123])('does not invent or accept a malformed client ID (%s)', async id => {
    tag(id); // undefined would use the helper default, override it explicitly.
    if (id === undefined) vi.stubGlobal('gtag', vi.fn((_a, _i, _f, cb) => cb(undefined)));
    expect(await getGa4BookingContext()).toBeNull();
  });
  it('drops a malformed session ID and accepts a safe numeric session ID', async () => {
    tag('123.456', 'personal words'); expect(await getGa4BookingContext()).not.toHaveProperty('session_id');
    tag('123.456', 123456); expect(await getGa4BookingContext()).toHaveProperty('session_id', '123456');
  });
  it('bounds an unavailable callback to 300ms without blocking the booking', async () => {
    vi.useFakeTimers(); vi.stubGlobal('gtag', vi.fn());
    const pending = getGa4BookingContext(); await vi.advanceTimersByTimeAsync(300);
    expect(await pending).toBeNull();
  });
  it('survives tag exceptions and inaccessible browser storage', async () => {
    vi.stubGlobal('gtag', vi.fn(() => { throw new Error('tag unavailable'); }));
    expect(await getGa4BookingContext()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(await getGa4BookingContext()).toBeNull();
  });
  it('honours consent withdrawal while Google callbacks are pending', async () => {
    const callbacks: Array<(value: string) => void> = [];
    vi.stubGlobal('gtag', vi.fn((_a, _i, _f, callback) => callbacks.push(callback)));
    const pending = getGa4BookingContext(); consent(false);
    callbacks[0]('123.456'); callbacks[1]('789');
    expect(await pending).toBeNull();
  });
});
