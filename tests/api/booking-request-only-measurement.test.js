import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookingMeasurementSelection, createGoogleDataManagerAdapter, dataManagerMeasurementPayload, deliverBookingMeasurements } from '../../api/_lib/depositMeasurement.js';

const cutoff = '2026-11-03T18:00:00.000Z';
const request = (extra = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  booking_id: '22222222-2222-4222-8222-222222222222',
  event_key: 'booking:22222222-2222-4222-8222-222222222222:booking_request_submitted',
  event_name: 'booking_request_submitted', provider: 'google_data_manager',
  created_at: cutoff, occurred_at: cutoff, is_test: false, status: 'sending',
  attribution: { gclid: 'synthetic.fixture' }, match_data: {},
  consent: { advertising: true, version: '2026-07-14', recorded_at: cutoff },
  amount_pence: null, currency: null, payment_type: null, payment_external_id: null,
  ...extra,
});
function configure() {
  for (const [key, value] of Object.entries({
    BOOKING_MEASUREMENT_SCOPE: 'request_only', BOOKING_MEASUREMENT_REQUEST_SINCE: cutoff,
    BOOKING_MEASUREMENT_MATCHING: 'click_id_only',
    BOOKING_MEASUREMENT_MODE: 'live', GOOGLE_ADS_CUSTOMER_ID: '1234567890',
    GOOGLE_DATA_MANAGER_CLIENT_ID: 'fixture', GOOGLE_DATA_MANAGER_CLIENT_SECRET: 'fixture',
    GOOGLE_DATA_MANAGER_REFRESH_TOKEN: 'fixture',
    GOOGLE_ADS_BOOKING_REQUEST_SUBMITTED_CONVERSION_ACTION_ID: '111111111',
    GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID: '', GOOGLE_ADS_BOOKING_REQUEST_QUALIFIED_CONVERSION_ACTION_ID: '',
    GOOGLE_ADS_BOOKING_CONFIRMED_CONVERSION_ACTION_ID: '', VERCEL_ENV: 'production',
  })) vi.stubEnv(key, value);
}
afterEach(() => vi.unstubAllEnvs());
function deliveryDb({ saveFails = false } = {}) {
  const stored = request();
  const updates = [];
  const db = {
    rpc: vi.fn(async () => ({ data: [{ ...stored }] })),
    from(table) {
      let patch;
      const query = {
        select() { return query; }, eq() { return query; },
        update(value) { patch = value; return query; },
        async maybeSingle() {
          return { data: table === 'booking_measurement_outbox' ? stored : {
            measurement_advertising_consent: true, measurement_consent_version: '2026-07-14',
            measurement_consent_recorded_at: cutoff, measurement_is_test: false,
          } };
        },
        then(resolve) {
          if (saveFails) return Promise.resolve({ error: { code: 'fixture_failure' } }).then(resolve);
          if (patch) { updates.push(patch); Object.assign(stored, patch); }
          return Promise.resolve({ data: [{ id: stored.id }] }).then(resolve);
        },
      };
      return query;
    },
    stored, updates,
  };
  return db;
}
describe('request-only reporting boundary', () => {
  it('accepts the exact ISO activation cutoff', () => {
    configure();
    expect(bookingMeasurementSelection()).toEqual({ scope: 'request_only', cutoff, matching: 'click_id_only' });
  });
  it('preserves unconfigured legacy behavior but rejects partial and unknown selection', () => {
    expect(bookingMeasurementSelection({})).toEqual({ scope: 'legacy' });
    for (const env of [
      { BOOKING_MEASUREMENT_SCOPE: 'all' }, { BOOKING_MEASUREMENT_SCOPE: 'request_only' },
      { BOOKING_MEASUREMENT_REQUEST_SINCE: cutoff },
      { BOOKING_MEASUREMENT_SCOPE: 'request_only', BOOKING_MEASUREMENT_MATCHING: 'click_id_only', BOOKING_MEASUREMENT_REQUEST_SINCE: '2026-02-30T00:00:00.000Z' },
    ]) expect(bookingMeasurementSelection(env)).toBeNull();
  });
  it('requires only request action binding and still obeys disabled mode', () => {
    configure();
    expect(createGoogleDataManagerAdapter().configured).toBe(true);
    vi.stubEnv('BOOKING_MEASUREMENT_MODE', 'disabled');
    expect(createGoogleDataManagerAdapter().configured).toBe(false);
  });
  it('direct adapter cannot send while disabled or override validate mode into live', async () => {
    configure(); const fetchFn = vi.fn();
    vi.stubEnv('BOOKING_MEASUREMENT_MODE', 'disabled');
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request())).rejects.toThrow('measurement_request_mode_disabled');
    vi.stubEnv('BOOKING_MEASUREMENT_MODE', 'validate');
    await expect(createGoogleDataManagerAdapter({ fetchFn, validateOnly: false }).send(request())).rejects.toThrow('measurement_request_mode_disabled');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('validates the identical genuine-shaped fixture before its single mocked live ingest', async () => {
    configure();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ requestId: 'fixture-receipt' }) });
    const beforeLive = vi.fn();
    const result = await createGoogleDataManagerAdapter({ fetchFn }).send(request(), { beforeLive });
    const preflight = JSON.parse(fetchFn.mock.calls[1][1].body);
    const live = JSON.parse(fetchFn.mock.calls[2][1].body);
    expect(preflight).toEqual({ ...live, validateOnly: true });
    expect(live.validateOnly).toBe(false); expect(beforeLive).toHaveBeenCalledTimes(1);
    expect(result.state).toBe('submitted');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
  it.each(['reject', 'warning', 'timeout', 'invalid_json'])('never ingests live after preflight %s', async (kind) => {
    configure();
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) });
    if (kind === 'timeout') fetchFn.mockRejectedValueOnce(new Error('timeout'));
    else fetchFn.mockResolvedValueOnce({ ok: kind !== 'reject', json: async () => {
      if (kind === 'invalid_json') throw Error('parse');
      return kind === 'warning' ? { fieldWarnings: [{ reason: 'fixture_warning' }] } : {};
    } });
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request())).rejects.toThrow('request_preflight_');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('rechecks eligibility after preflight and stops before live when consent changes', async () => {
    configure();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request(), {
      beforeLive: async () => { throw Error('consent changed'); },
    })).rejects.toThrow('consent changed');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('worker re-reads persisted consent after mocked preflight and suppresses a withdrawn request', async () => {
    configure(); const db = deliveryDb();
    let withdrawn = false;
    const originalFrom = db.from;
    db.from = (table) => {
      const query = originalFrom(table);
      const originalRead = query.maybeSingle;
      query.maybeSingle = async () => {
        const result = await originalRead();
        if (table === 'bookings' && withdrawn) result.data.measurement_consent_withdrawn_at = cutoff;
        return result;
      };
      return query;
    };
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) })
      .mockImplementationOnce(async () => { withdrawn = true; return { ok: true, json: async () => ({}) }; });
    const result = await deliverBookingMeasurements(db, { fetchFn });
    expect(result.suppressed).toBe(1);
    expect(db.stored.last_error).toBe('request_preflight_eligibility_changed');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('selects the atomic request RPC with the exact cutoff', async () => {
    configure();
    const db = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    await deliverBookingMeasurements(db);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('claim_booking_request_measurements', { p_since: cutoff, p_limit: 10 });
  });
  it('invalid selection cannot claim even with an injected adapter', async () => {
    configure(); vi.stubEnv('BOOKING_MEASUREMENT_REQUEST_SINCE', '');
    const db = { rpc: vi.fn() };
    expect((await deliverBookingMeasurements(db, { adapters: { google_data_manager: {} } })).status).toBe('disabled');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('does not fall back to the broad RPC if the migration is absent', async () => {
    configure();
    const db = { rpc: vi.fn().mockResolvedValue({ error: { code: '42883' } }) };
    await expect(deliverBookingMeasurements(db)).rejects.toThrow('measurement_outbox_claim_failed');
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['deposit_paid', 'booking_confirmed', 'booking_request_qualified'])('refuses %s before any provider preparation or mutation', async (event_name) => {
    configure();
    const adapter = { prepare: vi.fn(), send: vi.fn(), check: vi.fn() };
    const db = { rpc: vi.fn().mockResolvedValue({ data: [request({ event_name })] }), from: vi.fn() };
    await expect(deliverBookingMeasurements(db, { adapters: { google_data_manager: adapter } })).rejects.toThrow('measurement_claim_scope_mismatch');
    expect(adapter.prepare).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
  });
  it.each([
    { created_at: '2026-11-02T18:00:00.000Z' }, { occurred_at: '2026-11-02T18:00:00.000Z' },
    { created_at: undefined }, { is_test: true }, { provider: 'other' },
  ])('rejects out-of-bound row %j in payload, direct send and diagnostic polling', async (extra) => {
    configure(); const fetchFn = vi.fn(); const adapter = createGoogleDataManagerAdapter({ fetchFn });
    expect(() => dataManagerMeasurementPayload(request(extra))).toThrow('measurement_selection_rejected');
    await expect(adapter.send(request(extra))).rejects.toThrow('measurement_selection_rejected');
    await expect(adapter.check(request({ ...extra, status: 'submitted' }))).rejects.toThrow('measurement_selection_rejected');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('unpaid request produces a stable non-monetary event and validation remains distinct', () => {
    configure();
    const payload = dataManagerMeasurementPayload(request(), { validateOnly: true });
    expect(payload.validateOnly).toBe(true);
    expect(payload.events[0].transactionId).toBe(request().event_key);
    expect(payload.events[0]).not.toHaveProperty('conversionValue');
    expect(payload.events[0]).not.toHaveProperty('currency');
    expect(payload).toEqual(dataManagerMeasurementPayload(request(), { validateOnly: true }));
  });
  it('request scope does not relax consent or test eligibility', () => {
    configure();
    expect(() => dataManagerMeasurementPayload(request({ consent: { advertising: false } }))).toThrow('measurement_consent_unavailable');
    expect(() => dataManagerMeasurementPayload(request({ consent: { advertising: true, withdrawn_at: cutoff } }))).toThrow('measurement_consent_unavailable');
  });
  it.each(['timeout', 'response_lost'])('holds uncertain %s instead of scheduling a resend', async (reason) => {
    configure(); const db = deliveryDb();
    const adapter = { prepare: vi.fn(), send: vi.fn().mockRejectedValue(new Error(reason)) };
    const result = await deliverBookingMeasurements(db, { adapters: { google_data_manager: adapter } });
    expect(result.suppressed).toBe(1);
    expect(db.stored).toMatchObject({ status: 'suppressed', next_attempt_at: null, last_error: 'request_send_outcome_unknown' });
    expect(adapter.send).toHaveBeenCalledTimes(1);
  });
  it('receipt-save failure leaves sending for SQL quarantine, never labels it safe to retry', async () => {
    configure(); const db = deliveryDb({ saveFails: true });
    const adapter = { prepare: vi.fn(), send: vi.fn().mockResolvedValue({ state: 'submitted', acknowledgement: 'fixture' }) };
    await expect(deliverBookingMeasurements(db, { adapters: { google_data_manager: adapter } })).rejects.toThrow('measurement_state_save_failed');
    expect(db.stored.status).toBe('sending');
    expect(adapter.send).toHaveBeenCalledTimes(1);
  });
  it('polls a submitted request without sending it again', async () => {
    configure(); const db = deliveryDb(); db.stored.status = 'submitted';
    const adapter = { prepare: vi.fn(), send: vi.fn(), check: vi.fn().mockResolvedValue({ state: 'delivered', acknowledgement: 'fixture' }) };
    const result = await deliverBookingMeasurements(db, { adapters: { google_data_manager: adapter } });
    expect(result.delivered).toBe(1); expect(adapter.send).not.toHaveBeenCalled();
    expect(adapter.check).toHaveBeenCalledTimes(1);
  });
  it('holds failed processing diagnostics for review rather than re-uploading', async () => {
    configure(); const db = deliveryDb(); db.stored.status = 'submitted';
    const adapter = { prepare: vi.fn(), send: vi.fn(), check: vi.fn().mockResolvedValue({ state: 'failed', acknowledgement: 'fixture', error: 'processing_failed' }) };
    expect((await deliverBookingMeasurements(db, { adapters: { google_data_manager: adapter } })).suppressed).toBe(1);
    expect(db.stored).toMatchObject({ status: 'suppressed', next_attempt_at: null, last_error: 'processing_failed' });
    expect(adapter.send).not.toHaveBeenCalled();
  });
});


describe('approved click-ID-only request amendment', () => {
  const hashes = { email_sha256: 'a'.repeat(64), phone_sha256: 'b'.repeat(64) };
  it.each(['', 'hashes', 'CLICK_ID_ONLY'])('fails closed for missing or unsupported matching %j before claiming', async (matching) => {
    configure(); vi.stubEnv('BOOKING_MEASUREMENT_MATCHING', matching);
    const db = { rpc: vi.fn() }; const fetchFn = vi.fn();
    expect(bookingMeasurementSelection()).toBeNull();
    expect(createGoogleDataManagerAdapter({ fetchFn }).configured).toBe(false);
    expect((await deliverBookingMeasurements(db, { fetchFn })).status).toBe('disabled');
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request())).rejects.toThrow('measurement_selection_rejected');
    expect(db.rpc).not.toHaveBeenCalled(); expect(fetchFn).not.toHaveBeenCalled();
  });
  it('does not treat a lone matching flag as legacy configuration', () => {
    expect(bookingMeasurementSelection({ BOOKING_MEASUREMENT_MATCHING: 'click_id_only' })).toBeNull();
  });
  it.each([
    [{ gclid: 'fixture.g', gbraid: 'fixture.b', wbraid: 'fixture.w' }, { gclid: 'fixture.g' }],
    [{ gclid: 'invalid space', gbraid: 'fixture.b', wbraid: 'fixture.w' }, { gbraid: 'fixture.b' }],
    [{ wbraid: 'fixture.w' }, { wbraid: 'fixture.w' }],
  ])('sends one valid click identifier without hashes or monetary value: %j', (attribution, expected) => {
    configure();
    const payload = dataManagerMeasurementPayload(request({ attribution, match_data: hashes }));
    expect(payload).not.toHaveProperty('encoding');
    expect(payload.events).toEqual([{
      adIdentifiers: expected, eventTimestamp: cutoff,
      transactionId: request().event_key, eventSource: 'WEB',
    }]);
    expect(payload.destinations[0].productDestinationId).toBe('111111111');
    expect(payload.consent).toEqual({ adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_GRANTED' });
    expect(JSON.stringify(payload)).not.toContain(hashes.email_sha256);
    expect(JSON.stringify(payload)).not.toContain(hashes.phone_sha256);
  });
  it.each([{}, { gclid: '' }, { gclid: 'bad space' }, { gclid: 'x'.repeat(201) }])('suppresses unmatched request %j before OAuth or ingestion, with a known exclusion reason', async (attribution) => {
    configure(); const db = deliveryDb(); const fetchFn = vi.fn();
    Object.assign(db.stored, { attribution, match_data: hashes });
    expect((await deliverBookingMeasurements(db, { fetchFn })).suppressed).toBe(1);
    expect(db.stored).toMatchObject({ status: 'suppressed', last_error: 'request_click_id_unavailable', next_attempt_at: null, claimed_at: null });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(() => dataManagerMeasurementPayload(request({ attribution, match_data: hashes }))).toThrow('request_click_id_unavailable');
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request({ attribution, match_data: hashes }))).rejects.toThrow('request_click_id_unavailable');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('does not quarantine a known unsent exclusion as an ambiguous upload if its save fails', async () => {
    configure(); const db = deliveryDb({ saveFails: true }); const fetchFn = vi.fn();
    db.stored.attribution = {};
    await expect(deliverBookingMeasurements(db, { fetchFn })).rejects.toThrow('measurement_state_save_failed');
    expect(fetchFn).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
  });
  it('still polls an already submitted receipt without click data, without uploading it again', async () => {
    configure(); const db = deliveryDb(); Object.assign(db.stored, { status: 'submitted', attribution: {}, match_data: hashes });
    const adapter = { prepare: vi.fn(), send: vi.fn(), check: vi.fn().mockResolvedValue({ state: 'delivered', acknowledgement: 'fixture' }) };
    expect((await deliverBookingMeasurements(db, { adapters: { google_data_manager: adapter } })).delivered).toBe(1);
    expect(adapter.check).toHaveBeenCalledTimes(1); expect(adapter.send).not.toHaveBeenCalled();
  });
  it('keeps matching data in legacy payloads when request-only configuration is absent', () => {
    configure();
    for (const key of ['BOOKING_MEASUREMENT_SCOPE', 'BOOKING_MEASUREMENT_REQUEST_SINCE', 'BOOKING_MEASUREMENT_MATCHING']) vi.stubEnv(key, '');
    const payload = dataManagerMeasurementPayload(request({ attribution: {}, match_data: hashes }));
    expect(payload.encoding).toBe('HEX');
    expect(payload.events[0].userData.userIdentifiers).toEqual([{ emailAddress: hashes.email_sha256 }, { phoneNumber: hashes.phone_sha256 }]);
  });
  it('validates and ingests the identical click-only payload once even when stored hashes exist', async () => {
    configure();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ requestId: 'fixture-receipt' }) });
    await createGoogleDataManagerAdapter({ fetchFn }).send(request({ match_data: hashes }), { beforeLive: vi.fn() });
    const validation = JSON.parse(fetchFn.mock.calls[1][1].body);
    const live = JSON.parse(fetchFn.mock.calls[2][1].body);
    expect(validation).toEqual({ ...live, validateOnly: true });
    expect(live.events[0]).not.toHaveProperty('userData'); expect(live).not.toHaveProperty('encoding');
    expect(live.events[0].transactionId).toBe(request().event_key);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
  it.each(['matching', 'scope_removed', 'mode', 'cutoff'])('stops live ingest if %s changes during validation', async (change) => {
    configure();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) })
      .mockImplementationOnce(async () => {
        if (change === 'matching') vi.stubEnv('BOOKING_MEASUREMENT_MATCHING', 'hashes');
        if (change === 'mode') vi.stubEnv('BOOKING_MEASUREMENT_MODE', 'disabled');
        if (change === 'cutoff') vi.stubEnv('BOOKING_MEASUREMENT_REQUEST_SINCE', '2026-11-01T00:00:00.000Z');
        if (change === 'scope_removed') for (const key of ['BOOKING_MEASUREMENT_SCOPE', 'BOOKING_MEASUREMENT_REQUEST_SINCE', 'BOOKING_MEASUREMENT_MATCHING']) vi.stubEnv(key, '');
        return { ok: true, json: async () => ({}) };
      });
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request(), { beforeLive: vi.fn() })).rejects.toThrow(/measurement_selection_rejected|request_preflight_mode_changed/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('rechecks matching after the asynchronous final eligibility guard', async () => {
    configure();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fixture-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(createGoogleDataManagerAdapter({ fetchFn }).send(request(), {
      beforeLive: async () => vi.stubEnv('BOOKING_MEASUREMENT_MATCHING', ''),
    })).rejects.toThrow('request_preflight_mode_changed');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
