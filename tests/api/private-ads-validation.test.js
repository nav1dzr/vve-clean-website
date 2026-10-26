import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPrivateAdsValidation } from '../../api/_lib/privateAdsValidation.js';
import { PLAN_ID, CLAIM_TABLE, PAYLOAD_TEMPLATE_SHA256, validationPayload, validationDispatch } from '../../admin/api/_lib/adsValidationPolicy.js';

const NOW = Date.parse('2030-01-01T12:00:00.000Z');
const sourceHash = 'a'.repeat(64);
const binding = { sourceManifestSha256: sourceHash, executionAuthoritySha256: 'b'.repeat(64),
  startsAt: '2030-01-01T11:59:00.000Z', endsAt: '2030-01-01T12:10:00.000Z' };
const env = { VERCEL_ENV: 'production', BOOKING_MEASUREMENT_MODE: 'disabled',
  VITE_SUPABASE_URL: 'https://temlphabsqukkiqmrvhl.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'MOCK',
  GOOGLE_ADS_CUSTOMER_ID: '5569099303', GOOGLE_ADS_LOGIN_CUSTOMER_ID: '2421356882',
  GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID: '7793447505', GOOGLE_DATA_MANAGER_CLIENT_ID: 'MOCK',
  GOOGLE_DATA_MANAGER_CLIENT_SECRET: 'MOCK', GOOGLE_DATA_MANAGER_REFRESH_TOKEN: 'MOCK' };
function req(patch = {}) {
  return { method: 'POST', url: '/api/admin-ads-validation', body: { planId: PLAN_ID },
    headers: { host: 'www.vveclean.co.uk', origin: 'https://admin.vveclean.co.uk',
      authorization: 'Bearer MOCK.jwt', 'content-type': 'application/json' }, ...patch };
}
function res() { return { writeHead(code, headers) { this.code = code; this.headers = headers; },
  end(raw) { this.body = JSON.parse(raw); } }; }
function fixture(overrides = {}) {
  let stored;
  const insert = vi.fn(row => ({ select: () => ({ single: async () => {
    if (stored) return { error: { code: '23505' } };
    stored = row; return { data: { plan_id: PLAN_ID } };
  } }) }));
  const read = vi.fn(async () => ({ data: stored ? { plan_id: PLAN_ID } : null }));
  const db = { from: vi.fn(table => {
    if (table !== CLAIM_TABLE) throw new Error('Unexpected table');
    return { insert, select: () => ({ eq: () => ({ maybeSingle: read }) }) };
  }) };
  const deps = { env: { ...env }, binding: { ...binding }, sourceHash, now: () => NOW,
    authenticate: vi.fn().mockResolvedValue({ ok: true }), database: vi.fn(() => db),
    fetchImpl: vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'MOCK-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }), ...overrides };
  return { deps, insert, read, db, handler: createPrivateAdsValidation(deps) };
}
async function run(f, request = req()) { const response = res(); await f.handler(request, response); return response; }

describe('private Ads validation website boundary', () => {
  it('default source/window binding is closed before authentication or effects', async () => {
    const f = fixture({ binding: undefined, sourceHash: undefined });
    expect((await run(f)).body).toEqual({ status: 'closed' });
    expect(f.deps.authenticate).not.toHaveBeenCalled(); expect(f.db.from).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    ['VERCEL_ENV', 'preview'], ['VERCEL_ENV', 'development'], ['VERCEL_ENV', ''],
    ['BOOKING_MEASUREMENT_MODE', 'live'], ['BOOKING_MEASUREMENT_MODE', 'validate'], ['BOOKING_MEASUREMENT_MODE', ''],
    ['GOOGLE_ADS_CUSTOMER_ID', 'wrong'], ['GOOGLE_ADS_LOGIN_CUSTOMER_ID', 'wrong'],
    ['GOOGLE_ADS_DEPOSIT_CONVERSION_ACTION_ID', 'wrong'], ['GOOGLE_DATA_MANAGER_REFRESH_TOKEN', ''],
    ['VITE_SUPABASE_URL', 'https://wrong.supabase.co'], ['SUPABASE_URL', 'https://wrong.supabase.co'],
  ])('fails closed for %s=%s', async (key, value) => {
    const f = fixture({ env: { ...env, [key]: value } });
    expect((await run(f)).body.status).toBe('closed');
    expect(f.deps.authenticate).not.toHaveBeenCalled(); expect(f.db.from).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    { sourceManifestSha256: 'c'.repeat(64) }, { executionAuthoritySha256: null },
    { startsAt: '2030-01-01T12:01:00.000Z' }, { endsAt: '2030-01-01T12:00:00.000Z' },
    { endsAt: '2030-01-02T12:00:00.000Z' }, { startsAt: '2030-01-01T11:59:00+00:00' },
  ])('rejects unbound or invalid window %#', async patch => {
    const f = fixture({ binding: { ...binding, ...patch } });
    expect((await run(f)).body.status).toBe('closed'); expect(f.db.from).not.toHaveBeenCalled();
  });
  it.each([
    { method: 'PUT' }, { method: 'OPTIONS' }, { url: '/api/admin-ads-validation?target=other' },
    { url: '/x/../api/admin-ads-validation' }, { url: '/api/admin-ads-validation#fragment' },
    { url: '/api/admin-ads-validation/' },
    { url: '/api/booking-management?resource=admin-ads-validation&action=process-due' },
    { url: 'https://evil.example/api/admin-ads-validation' }, { body: { planId: PLAN_ID, payload: {} } },
    { body: { planId: 'wrong' } }, { body: 'not json' }, { body: 'x'.repeat(257) },
    { body: [] }, { body: null },
  ])('rejects non-exact request %#', async patch => {
    const f = fixture(); const response = await run(f, req(patch));
    expect([400, 503]).toContain(response.code); expect(f.deps.authenticate).not.toHaveBeenCalled();
    expect(f.db.from).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([['origin', 'https://evil.example'], ['origin', undefined], ['host', 'evil.example'],
    ['authorization', ''], ['content-type', 'text/plain']])('rejects bad %s', async (key, value) => {
    const f = fixture(); const request = req(); request.headers[key] = value;
    expect((await run(f, request)).code).toBe(400); expect(f.deps.authenticate).not.toHaveBeenCalled();
  });
  it.each([['content-length', '1'], ['content-length', 'invalid'], ['transfer-encoding', 'chunked']])('rejects streamed GET body %s', async (key, value) => {
    const f = fixture(); const request = req({ method: 'GET', body: undefined }); request.headers[key] = value;
    expect((await run(f, request)).code).toBe(400); expect(f.deps.authenticate).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500])('requires independent admin verification %s', async status => {
    const f = fixture({ authenticate: vi.fn().mockResolvedValue({ ok: false, status, error: 'PRIVATE-ERROR' }) });
    expect((await run(f)).body).toEqual({ status: 'denied' }); expect(f.db.from).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('readiness is read-only; successful POST claims before exactly two provider requests', async () => {
    const f = fixture();
    expect((await run(f, req({ method: 'GET', body: undefined }))).body.status).toBe('ready');
    expect(f.insert).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
    const result = await run(f);
    expect(result.body).toEqual({ status: 'validated', warningCount: 0 });
    expect(f.insert).toHaveBeenCalledExactlyOnceWith({ plan_id: PLAN_ID, source_sha256: sourceHash,
      payload_sha256: PAYLOAD_TEMPLATE_SHA256, authority_sha256: binding.executionAuthoritySha256,
      approved_start: binding.startsAt, approved_end: binding.endsAt });
    expect(f.insert.mock.invocationCallOrder[0]).toBeLessThan(f.deps.fetchImpl.mock.invocationCallOrder[0]);
    expect(f.deps.authenticate).toHaveBeenCalledWith(expect.anything(), { redactErrors: true });
    expect(f.deps.fetchImpl).toHaveBeenCalledTimes(2);
    expect(f.deps.fetchImpl.mock.calls.map(call => call[0])).toEqual([
      'https://oauth2.googleapis.com/token', 'https://datamanager.googleapis.com/v1/events:ingest']);
    for (const [, options] of f.deps.fetchImpl.mock.calls) expect(options.redirect).toBe('error');
    expect(JSON.parse(f.deps.fetchImpl.mock.calls[1][1].body)).toEqual(validationPayload(binding.startsAt));
    expect(result.headers['Cache-Control']).toContain('no-store');
    expect(JSON.stringify(result.body)).not.toMatch(/MOCK|token|requestId/);
    expect((await run(f, req({ method: 'GET', body: undefined }))).body.status).toBe('consumed');
  });
  it('mock unique constraint admits one concurrent winner and blocks all later attempts', async () => {
    const f = fixture();
    const results = await Promise.all([run(f), run(f)]);
    expect(results.map(r => r.body.status).sort()).toEqual(['consumed', 'validated']);
    expect((await run(f)).body.status).toBe('consumed'); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(2);
  });
  it.each(['error', 'unknown', 'wrong-return'])('never contacts provider after %s claim', async kind => {
    const f = fixture();
    f.insert.mockImplementation(() => ({ select: () => ({ single: async () => {
      if (kind === 'unknown') throw new Error('DB-SECRET');
      return kind === 'error' ? { error: { message: 'DB-SECRET' } } : { data: { plan_id: 'wrong' } };
    } }) }));
    expect(['consumed', 'uncertain']).toContain((await run(f)).body.status); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('expiry after successful claim consumes attempt before OAuth', async () => {
    let clock = NOW; const f = fixture({ now: () => clock });
    f.insert.mockImplementation(() => ({ select: () => ({ single: async () => {
      clock = Date.parse(binding.endsAt); return { data: { plan_id: PLAN_ID } };
    } }) }));
    expect((await run(f)).body.status).toBe('consumed'); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('expiry during OAuth prevents ingest', async () => {
    let clock = NOW; const f = fixture({ now: () => clock });
    f.deps.fetchImpl.mockReset().mockImplementation(async () => {
      clock = Date.parse(binding.endsAt); return { ok: true, json: async () => ({ access_token: 'mock' }) };
    });
    expect((await run(f)).body.status).toBe('consumed'); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('expiry during admin auth prevents database access', async () => {
    let clock = NOW;
    const f = fixture({ now: () => clock, authenticate: vi.fn(async () => {
      clock = Date.parse(binding.endsAt); return { ok: true };
    }) });
    expect((await run(f)).body.status).toBe('closed'); expect(f.db.from).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('GET database error never contacts provider', async () => {
    const f = fixture(); f.read.mockResolvedValue({ error: { message: 'PRIVATE' } });
    expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'unavailable', stage: 'website', reason: 'CLAIM_LOOKUP_FAILED' });
    expect(f.insert).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(['missing', 'throws'])('authenticated GET safely identifies claim store %s', async kind => {
    const database = vi.fn(() => { if (kind === 'throws') throw new Error('PRIVATE-DB-TOKEN'); return null; });
    const f = fixture({ database });
    const result = await run(f, req({ method: 'GET', body: undefined }));
    expect(result.body).toEqual({ status: 'unavailable', stage: 'website', reason: 'CLAIM_STORE_UNAVAILABLE' });
    expect(f.insert).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('auth exceptions never reveal readiness codes or raw values', async () => {
    const log = vi.spyOn(console, 'error');
    try {
      const f = fixture({ authenticate: vi.fn().mockRejectedValue(new Error('PRIVATE-TOKEN')) });
      expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'unavailable' });
      expect(f.deps.database).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('a thrown lookup stays sanitized and GET has no provider or claim effect', async () => {
    const f = fixture(); f.read.mockRejectedValue(new Error('PRIVATE-DB-TOKEN'));
    expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'unavailable', stage: 'website', reason: 'CLAIM_LOOKUP_FAILED' });
    expect(f.insert).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('GET cannot announce ready after the window expires during lookup', async () => {
    let clock = NOW; const f = fixture({ now: () => clock });
    f.read.mockImplementation(async () => { clock = Date.parse(binding.endsAt); return { data: null }; });
    expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'closed', stage: 'website', reason: 'GUARD_CHANGED' });
    expect(f.insert).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([undefined, [], {}, { plan_id: 'wrong' }, { plan_id: PLAN_ID, extra: 'PRIVATE' }, false, 'PRIVATE'])('does not turn malformed lookup data into readiness %#', async data => {
    const f = fixture(); f.read.mockResolvedValue({ data });
    expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'unavailable', stage: 'website', reason: 'CLAIM_LOOKUP_FAILED' });
    expect(f.insert).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([null, false, {}, { ok: 'true' }, { ok: 1 }])('unexpected auth result remains generic %#', async result => {
    const f = fixture({ authenticate: vi.fn().mockResolvedValue(result) });
    expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'denied' });
    expect(f.deps.database).not.toHaveBeenCalled(); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(['SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_DATA_MANAGER_CLIENT_ID', 'GOOGLE_DATA_MANAGER_CLIENT_SECRET'])('missing %s stays generic before authentication', async key => {
    const f = fixture({ env: { ...env, [key]: '' } });
    expect((await run(f, req({ method: 'GET', body: undefined }))).body).toEqual({ status: 'closed' });
    expect(f.deps.authenticate).not.toHaveBeenCalled(); expect(f.deps.database).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(['oauth-http', 'ingest-http', 'ingest-timeout'])('no retry on %s', async failure => {
    const f = fixture(); f.deps.fetchImpl.mockReset()
      .mockResolvedValueOnce({ ok: failure !== 'oauth-http', json: async () => ({ access_token: 'mock' }) });
    if (failure === 'ingest-timeout') f.deps.fetchImpl.mockRejectedValueOnce(new Error('TIMEOUT-PRIVATE'));
    else f.deps.fetchImpl.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'PRIVATE' }) });
    expect((await run(f)).body).toEqual({ status: 'uncertain' });
    expect(f.deps.fetchImpl).toHaveBeenCalledTimes(failure === 'oauth-http' ? 1 : 2);
    expect((await run(f)).body.status).toBe('consumed');
  });
  it('provider timeouts are bounded at eight seconds with redirects rejected', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const f = fixture(); await run(f);
      expect(spy.mock.calls.map(call => call[0])).toEqual([8000, 8000]);
      expect(f.deps.fetchImpl.mock.calls.every(call => call[1].redirect === 'error' && call[1].signal)).toBe(true);
    } finally { spy.mockRestore(); }
  });
  it('OAuth crash never retries and claim persists', async () => {
    const f = fixture(); f.deps.fetchImpl.mockReset().mockRejectedValue(new Error('PRIVATE-TOKEN'));
    expect((await run(f)).body).toEqual({ status: 'uncertain' });
    expect((await run(f)).body).toEqual({ status: 'consumed' }); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([null, [], { error: { message: 'PRIVATE' } }, { requestId: 42 }, { fieldWarnings: 'x' },
    { fieldWarnings: [null] }, { fieldWarnings: [{ reason: 42 }] }, { requestId: 'id', error: {} }, 'invalid-json'])
    ('treats malformed provider response as uncertain %#', async body => {
      const f = fixture(); f.deps.fetchImpl.mockReset()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'mock' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => {
          if (body === 'invalid-json') throw new Error('RAW-PRIVATE'); return body;
        } });
      expect((await run(f)).body).toEqual({ status: 'uncertain' }); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(2);
    });
  it('returns warning counts only', async () => {
    const f = fixture(); f.deps.fetchImpl.mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'mock' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ requestId: 'PRIVATE', fieldWarnings: [{ description: 'PRIVATE', reason: 'WARNING' }] }) });
    expect((await run(f)).body).toEqual({ status: 'validated', warningCount: 1 });
  });
  it('reserved dispatch never sends malformed validation selectors to ordinary handlers', () => {
    expect(validationDispatch({ url: '/api/admin-ads-validation?x=1' })).toBe(true);
    expect(validationDispatch({ url: '/api/booking-management?resource=other&resource=admin-ads-validation' })).toBe(true);
    expect(validationDispatch({ url: '/api/booking-management?action=process-due' })).toBe(false);
  });
  it('migration is diagnostic-only, unique, no client grants and no mutable claims', () => {
    const sql = readFileSync('supabase/migrations/20261025010000_ads_validation_attempts.sql', 'utf8');
    expect(sql).toContain('plan_id text primary key'); expect(sql).toContain('enable row level security');
    expect(sql).toContain('grant select, insert on table public.ads_validation_attempts to service_role');
    expect(sql).not.toMatch(/\b(create policy|create trigger|references|grant update|grant delete|upsert)\b/i);
    expect(sql).not.toMatch(/public\.(bookings|customers|booking_measurement_outbox)/);
  });
});
