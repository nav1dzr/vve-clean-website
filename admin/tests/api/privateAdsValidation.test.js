import { describe, it, expect, vi } from 'vitest';
import { createAdsValidationForward } from '../../api/_lib/privateAdsValidationForward.js';
import { PLAN_ID, WEBSITE_ENDPOINT } from '../../api/_lib/adsValidationPolicy.js';

const sourceHash = 'a'.repeat(64);
const binding = { sourceManifestSha256: sourceHash, executionAuthoritySha256: 'b'.repeat(64),
  startsAt: '2030-01-01T11:59:00.000Z', endsAt: '2030-01-01T12:10:00.000Z' };
function request(patch = {}) { return { method: 'GET', url: '/api/admin-ads-validation',
  headers: { host: 'admin.vveclean.co.uk', authorization: 'Bearer MOCK.jwt', 'sec-fetch-site': 'same-origin' }, ...patch }; }
function fixture(overrides = {}) {
  const deps = { env: { VERCEL_ENV: 'production', BOOKING_MEASUREMENT_MODE: 'disabled',
    VITE_SUPABASE_URL: 'https://temlphabsqukkiqmrvhl.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'MOCK' },
  binding, sourceHash, now: () => Date.parse('2030-01-01T12:00:00.000Z'),
  authenticate: vi.fn().mockResolvedValue({ ok: true }),
  fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ready' }) }), ...overrides };
  return { deps, handler: createAdsValidationForward(deps) };
}
async function run(f, req = request()) {
  const res = { writeHead(code, headers) { this.code = code; this.headers = headers; }, end(body) { this.body = JSON.parse(body); } };
  await f.handler(req, res); return res;
}
describe('CRM private validation forwarding', () => {
  it('default closed before auth or forwarding', async () => {
    const f = fixture({ binding: undefined, sourceHash: undefined });
    expect((await run(f)).body).toEqual({ status: 'closed' }); expect(f.deps.authenticate).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('accepts real same-origin browser GET without Origin but requires bearer and host', async () => {
    const f = fixture(); const result = await run(f);
    expect(result.body).toEqual({ status: 'ready' });
    expect(f.deps.authenticate).toHaveBeenCalledWith(expect.anything(), { redactErrors: true });
    expect(f.deps.fetchImpl).toHaveBeenCalledWith(WEBSITE_ENDPOINT, expect.objectContaining({
      method: 'GET', redirect: 'error', headers: { authorization: 'Bearer MOCK.jwt', origin: 'https://admin.vveclean.co.uk' },
    }));
    expect(result.headers['Cache-Control']).toContain('no-store');
  });
  it.each([['sec-fetch-site', 'cross-site'], ['sec-fetch-site', undefined], ['host', 'other'],
    ['authorization', ''], ['origin', 'https://other'], ['content-length', '1'], ['transfer-encoding', 'chunked']])('rejects unsafe GET %s', async (key, value) => {
    const f = fixture(); const req = request(); req.headers[key] = value;
    expect((await run(f, req)).code).toBe(400); expect(f.deps.authenticate).not.toHaveBeenCalled();
    expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each(['/x/../api/admin-ads-validation', '/api/admin-ads-validation#x', '/api/me?resource=admin-ads-validation&x=1'])('rejects alias %s', async url => {
    const f = fixture(); expect((await run(f, request({ url }))).code).toBe(400);
    expect(f.deps.authenticate).not.toHaveBeenCalled();
  });
  it('POST requires strict origin and exact body; forward only approved headers/body', async () => {
    const f = fixture(); const req = request({ method: 'POST', body: { planId: PLAN_ID } });
    req.headers['content-type'] = 'application/json';
    expect((await run(f, req)).code).toBe(400); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
    req.headers.origin = 'https://admin.vveclean.co.uk'; req.headers['x-private'] = 'NOT-FORWARDED';
    f.deps.fetchImpl.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'validated', warningCount: 0 }) });
    expect((await run(f, req)).body).toEqual({ status: 'validated', warningCount: 0 });
    expect(f.deps.fetchImpl).toHaveBeenCalledTimes(1);
    expect(f.deps.fetchImpl.mock.calls[0][1].headers).toEqual({ authorization: 'Bearer MOCK.jwt',
      origin: 'https://admin.vveclean.co.uk', 'content-type': 'application/json' });
    expect(f.deps.fetchImpl.mock.calls[0][1].body).toBe(JSON.stringify({ planId: PLAN_ID }));
  });
  it('non-admin cannot forward', async () => {
    const f = fixture({ authenticate: vi.fn().mockResolvedValue({ ok: false, status: 403 }) });
    expect((await run(f)).body.status).toBe('denied'); expect(f.deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([null, [], { status: 'ready', token: 'PRIVATE' }, { status: 'validated', warningCount: '0' },
    { status: 'ready', error: 'PRIVATE' }])('rejects unexpected forwarding response %#', async body => {
    const f = fixture(); f.deps.fetchImpl.mockResolvedValue({ ok: true, status: 200, json: async () => body });
    expect((await run(f)).body).toEqual({ status: 'uncertain' });
  });
  it('does not turn an HTTP failure into readiness or retry on timeout', async () => {
    const f = fixture(); f.deps.fetchImpl.mockResolvedValue({ ok: false, status: 503, json: async () => ({ status: 'ready' }) });
    expect((await run(f)).body.status).toBe('uncertain');
    f.deps.fetchImpl.mockReset().mockRejectedValue(new Error('PRIVATE-TOKEN'));
    expect((await run(f)).body.status).toBe('uncertain'); expect(f.deps.fetchImpl).toHaveBeenCalledTimes(1);
  });
});
