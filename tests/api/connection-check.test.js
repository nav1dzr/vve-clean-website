import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createWebsiteCheck } from '../../api/connection-check.js';
import { createCrmCheck } from '../../admin/api/_lib/connectionCheckHandler.js';
import { CHECK_WINDOW, createLimiter, projectRef, refreshOnly, sanitiseWebsiteResult } from '../../admin/api/_lib/connectionCheck.js';
const start = Date.parse('2026-10-22T12:00:00Z');
const window = { opensAt: '2026-10-22T12:00:00Z', closesAt: '2026-10-22T12:30:00Z' };
const ref = 'abcdefghijklmnopqrst';
const baseEnv = { VERCEL_ENV: 'production', BOOKING_MEASUREMENT_MODE: 'disabled',
  VITE_SUPABASE_URL: `https://${ref}.supabase.co`, GOOGLE_DATA_MANAGER_CLIENT_ID: 'synthetic-client',
  GOOGLE_DATA_MANAGER_CLIENT_SECRET: 'synthetic-secret', GOOGLE_DATA_MANAGER_REFRESH_TOKEN: 'synthetic-refresh' };
const websiteResult = { runtime: 'website', databaseRef: ref, contactDatabaseRef: ref,
  status: 'refresh_succeeded', refreshSucceeded: true, scopeKnown: false };
function req(extra = {}) { return { method: 'POST', headers: { origin: 'https://admin.vveclean.co.uk',
  authorization: 'Bearer synthetic-session', 'content-type': 'application/json' }, body: { action: 'check' }, ...extra }; }
async function run(handler, request = req()) {
  const result = {};
  const res = { writeHead: (status, headers) => Object.assign(result, { status, headers }),
    end: body => { result.body = JSON.parse(body); } };
  await handler(request, res); return result;
}
function setup(factory, overrides = {}) {
  const env = { ...baseEnv };
  const verify = vi.fn(async () => ({ ok: true, admin: { id: 'synthetic-admin', email: 'never-return@example.invalid' } }));
  const fetchFn = vi.fn(async () => ({ ok: true, redirected: false, json: async () => factory === createWebsiteCheck ? { access_token: 'never-return-token' } : websiteResult }));
  const options = { env, window, now: () => start + 1, verify, fetchFn, ...overrides };
  return { handler: factory(options), ...options };
}
afterEach(() => vi.restoreAllMocks());
for (const [name, factory] of [['website', createWebsiteCheck], ['CRM', createCrmCheck]]) {
  describe(`${name} closed diagnostic`, () => {
    it.each([undefined, 'preview', 'development'])('blocks environment %s even with NODE_ENV production', async mode => {
      const x = setup(factory, { env: { ...baseEnv, VERCEL_ENV: mode, NODE_ENV: 'production' } });
      expect((await run(x.handler)).status).toBe(403); expect(x.verify).not.toHaveBeenCalled(); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it.each([undefined, 'validate', 'live', '', 'DISABLED'])('rejects reporting mode %s', async mode => {
      const x = setup(factory, { env: { ...baseEnv, BOOKING_MEASUREMENT_MODE: mode } });
      expect((await run(x.handler)).body.status).toBe('reporting_not_disabled'); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('defaults to an unscheduled closed window', async () => {
      const x = setup(factory, { window: CHECK_WINDOW }); expect((await run(x.handler)).status).toBe(503); expect(x.verify).not.toHaveBeenCalled();
    });
    it.each([start - 1, start + 30 * 60_000])('blocks outside the absolute window', async time => {
      const x = setup(factory, { now: () => time }); expect((await run(x.handler)).status).toBeGreaterThanOrEqual(400); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('rejects windows longer than 30 minutes', async () => {
      const x = setup(factory, { window: { ...window, closesAt: '2026-10-22T13:00:00Z' } });
      expect((await run(x.handler)).status).toBe(503);
    });
    it.each(['GET', 'OPTIONS', 'DELETE'])('has no side effects for %s', async method => {
      const x = setup(factory); expect((await run(x.handler, req({ method }))).status).toBe(405); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it.each([null, {}, [], { action: 'other' }, { action: 'check', url: 'https://evil.invalid' }, '{bad'])('rejects malformed or extended body', async body => {
      const x = setup(factory); expect((await run(x.handler, req({ body }))).status).toBe(400); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('rejects large bodies', async () => {
      const x = setup(factory); expect((await run(x.handler, req({ body: 'x'.repeat(1025) }))).status).toBe(413);
    });
    it('rejects an oversized streamed body before authentication', async () => {
      const x = setup(factory); const request = req(); delete request.body;
      request[Symbol.asyncIterator] = async function* () { yield 'x'.repeat(1025); };
      expect((await run(x.handler, request)).status).toBe(413); expect(x.verify).not.toHaveBeenCalled();
    });
    it('rejects non-JSON and untrusted origin', async () => {
      const x = setup(factory); const request = req(); request.headers['content-type'] = 'text/plain';
      expect((await run(x.handler, request)).status).toBe(415);
      request.headers['content-type'] = 'application/json'; request.headers.origin = 'https://evil.invalid';
      expect((await run(x.handler, request)).status).toBe(403); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('rejects missing bearer before auth', async () => {
      const x = setup(factory); const request = req(); delete request.headers.authorization;
      expect((await run(x.handler, request)).status).toBe(401); expect(x.verify).not.toHaveBeenCalled();
    });
    it.each([401, 403, 500])('rejects denied/failed auth %s without provider detail', async status => {
      const x = setup(factory, { verify: vi.fn(async () => ({ ok: false, status, error: 'private-provider-detail' })) });
      const result = await run(x.handler); expect(result.status).toBe(status === 500 ? 503 : status);
      expect(JSON.stringify(result)).not.toContain('private-provider-detail'); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('catches thrown authentication exceptions without logs', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const x = setup(factory, { verify: vi.fn(async () => { throw new Error('secret-token-email'); }) });
      expect((await run(x.handler)).body.status).toBe('authorisation_unavailable'); expect(log).not.toHaveBeenCalled(); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('rechecks expiry after slow authentication', async () => {
      let time = start + 1;
      const x = setup(factory, { now: () => time, verify: vi.fn(async () => { time = start + 30 * 60_000; return { ok: true, admin: { id: 'a' } }; }) });
      expect((await run(x.handler)).status).toBe(410); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('rechecks reporting mode after authentication', async () => {
      const env = { ...baseEnv };
      const x = setup(factory, { env, verify: vi.fn(async () => { env.BOOKING_MEASUREMENT_MODE = 'live'; return { ok: true, admin: { id: 'a' } }; }) });
      expect((await run(x.handler)).status).toBe(403); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('requires a valid database reference without querying business data', async () => {
      const x = setup(factory, { env: { ...baseEnv, VITE_SUPABASE_URL: 'invalid' } });
      expect((await run(x.handler)).status).toBe(503); expect(x.fetchFn).not.toHaveBeenCalled();
    });
    it('does not cache tokens or repeat on a second click', async () => {
      const x = setup(factory); const first = await run(x.handler);
      expect(first.status).toBe(200); expect(first.headers['Cache-Control']).toBe('private, no-store');
      expect(x.verify).toHaveBeenCalledWith(expect.anything(), { redactErrors: true });
      expect(JSON.stringify(first)).not.toMatch(/never-return|synthetic-secret|synthetic-session/);
      expect((await run(x.handler)).status).toBe(429); expect(x.fetchFn).toHaveBeenCalledTimes(1);
    });
    it('reserves before network I/O and blocks concurrency', async () => {
      let resolve; const fetchFn = vi.fn(() => new Promise(r => { resolve = r; }));
      const x = setup(factory, { fetchFn }); const first = run(x.handler);
      await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
      expect((await run(x.handler)).status).toBe(429);
      resolve({ ok: true, json: async () => factory === createWebsiteCheck ? { access_token: 'synthetic' } : websiteResult }); await first;
    });
  });
}
describe('strict provider and forwarding boundary', () => {
  it('makes one token-only call with no redirects and 8-second timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout'); const x = setup(createWebsiteCheck);
    await run(x.handler); expect(x.fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = x.fetchFn.mock.calls[0]; expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(options.redirect).toBe('error'); expect(options.body.get('grant_type')).toBe('refresh_token'); expect(timeout).toHaveBeenCalledWith(8000);
  });
  it.each([undefined, '', 'other.scope', 'https://www.googleapis.com/auth/datamanager other.scope'])('reports scope only when explicitly returned: %s', async scope => {
    const result = await refreshOnly(baseEnv, vi.fn(async () => ({ ok: true, json: async () => ({ access_token: 'hidden', ...(scope !== undefined ? { scope } : {}) }) })));
    expect(result.scopeKnown).toBe(scope !== undefined);
    if (scope === undefined) expect(result).not.toHaveProperty('datamanagerScopePresent');
    else expect(result.datamanagerScopePresent).toBe(scope.includes('https://www.googleapis.com/auth/datamanager'));
  });
  it('does not contact Google with missing credentials', async () => {
    const fetchFn = vi.fn(); expect((await refreshOnly({}, fetchFn)).status).toBe('credentials_missing'); expect(fetchFn).not.toHaveBeenCalled();
  });
  it('sanitises rejection without reading raw error body', async () => {
    const json = vi.fn(); expect((await refreshOnly(baseEnv, async () => ({ ok: false, json }))).status).toBe('refresh_rejected'); expect(json).not.toHaveBeenCalled();
  });
  it.each(['network', 'timeout', 'redirect'])('returns unknown without retry on %s errors', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('sensitive provider body'); });
    expect((await refreshOnly(baseEnv, fetchFn)).status).toBe('refresh_outcome_unknown'); expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('rejects non-token success responses', async () => {
    expect((await refreshOnly(baseEnv, async () => ({ ok: true, json: async () => ({ error: 'private' }) }))).status).toBe('refresh_unverified');
  });
  it('forwards only fresh bearer and content-type headers to the fixed Website', async () => {
    const x = setup(createCrmCheck); const request = req(); Object.assign(request.headers, { cookie: 'secret-cookie', 'x-target': 'evil', 'x-forwarded-host': 'evil' });
    await run(x.handler); const [url, options] = x.fetchFn.mock.calls[0];
    expect(url).toBe('https://www.vveclean.co.uk/api/connection-check'); expect(options.redirect).toBe('error');
    expect(options.headers).toEqual({ Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json' });
    expect(options.body).toBe('{"action":"check"}');
  });
  it('CRM requires browser origin; website accepts absent server-to-server origin with independent auth', async () => {
    const request = req(); delete request.headers.origin;
    const crm = setup(createCrmCheck); expect((await run(crm.handler, request)).status).toBe(403);
    const website = setup(createWebsiteCheck); expect((await run(website.handler, request)).status).toBe(200); expect(website.verify).toHaveBeenCalledTimes(1);
  });
  it('does not pass through upstream sensitive errors or retry unknown forwarding', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('private token'); });
    const x = setup(createCrmCheck, { fetchFn }); expect((await run(x.handler)).body.status).toBe('website_outcome_unknown'); expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('fails closed when independent website auth rejects CRM session', async () => {
    const x = setup(createCrmCheck, { fetchFn: vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'private' }) })) });
    expect((await run(x.handler)).body.status).toBe('website_check_unavailable');
  });
  it('strips unexpected upstream fields and sanitises project refs', () => {
    const out = sanitiseWebsiteResult({ ...websiteResult, access_token: 'hidden', email: 'private', databaseRef: 'https://secret.invalid' });
    expect(out.databaseRef).toBeNull(); expect(out).not.toHaveProperty('access_token'); expect(out).not.toHaveProperty('email');
    expect(() => sanitiseWebsiteResult({ status: 'arbitrary' })).toThrow();
  });
  it('caps three attempts per instance and enforces cooldown', () => {
    const reserve = createLimiter(); const release = reserve('u', start); release();
    expect(() => reserve('u', start + 59999)).toThrow(); reserve('u', start + 60000)(); reserve('u', start + 120000)();
    expect(() => reserve('u', start + 180000)).toThrow();
  });
  it.each(['http://abcdefghijklmnopqrst.supabase.co','https://u:p@abcdefghijklmnopqrst.supabase.co','https://abcdefghijklmnopqrst.supabase.co?token=x','https://evil.invalid'])('rejects unsafe reference %s', url => expect(projectRef(url)).toBeNull());
  it('has no business-data or reporting dependency and only fixed network destinations', () => {
    for (const file of ['api/connection-check.js', 'admin/api/_lib/connectionCheckHandler.js', 'admin/api/_lib/connectionCheck.js']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/from ['"].*(?:depositMeasurement|bookingJourneyWorker|bookingReadiness)/);
      expect(source).not.toMatch(/\.(?:from|rpc)\(|console\.|datamanager\.googleapis\.com/);
    }
  });
});
