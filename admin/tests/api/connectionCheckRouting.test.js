import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('../../api/_lib/adminAuth.js', () => ({ verifyAdminRequest: verify }));
let handler;
let fetchFn;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-25T00:14:59Z'));
  vi.resetModules();
  fetchFn = vi.fn();
  vi.stubGlobal('fetch', fetchFn);
  ({ default: handler } = await import('../../api/me.js'));
});

async function run(extra = {}) {
  const result = {};
  await handler({ method: 'POST', headers: {}, ...extra }, {
    writeHead: (status, headers) => Object.assign(result, { status, headers }),
    end: body => { result.body = body ? JSON.parse(body) : null; },
  });
  return result;
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('isolated diagnostic dispatch through me', () => {
  it.each([
    { url: '/api/me?diagnostic=connection-check-v1' },
    { url: '/api/connection-check', query: { diagnostic: 'connection-check-v1' } },
    { url: '/api/me?diagnostic=connection-check-v1', query: { diagnostic: 'connection-check-v1' } },
  ])('blocks preview before auth or network for %j', async request => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const result = await run(request);
    expect(result.status).toBe(403);
    expect(result.body).not.toHaveProperty('email');
    expect(verify).not.toHaveBeenCalled(); expect(fetchFn).not.toHaveBeenCalled();
  });
  it.each(['GET', 'POST', 'OPTIONS', 'DELETE'])('keeps production window closed for %s', async method => {
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('BOOKING_MEASUREMENT_MODE', 'disabled');
    const result = await run({ method, url: '/api/me?diagnostic=connection-check-v1' });
    expect(result.status).toBe(403); expect(result.body.status).toBe('window_not_open');
    expect(verify).not.toHaveBeenCalled();
  });
  it.each(['2026-10-25T00:45:00Z', '2026-10-25T01:15:00Z'])('rejects expiry and the repeated GMT hour: %s', async time => {
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('BOOKING_MEASUREMENT_MODE', 'disabled');
    vi.setSystemTime(new Date(time));
    const result = await run({ url: '/api/me?diagnostic=connection-check-v1' });
    expect(result.status).toBe(410); expect(result.body.status).toBe('window_expired');
    expect(verify).not.toHaveBeenCalled(); expect(fetchFn).not.toHaveBeenCalled();
  });
  it.each([
    { url: '/api/connection-check' },
    { url: '/api/me?diagnostic=' },
    { url: '/api/me?diagnostic=other' },
    { url: '/api/me?diagnostic=connection-check-v1&diagnostic=connection-check-v1' },
    { url: '/api/me?diagnostic=connection-check-v1&target=other' },
    { url: '/api/me?diagnostic[]=connection-check-v1' },
    { query: { diagnostic: ['connection-check-v1'] } },
    { query: { diagnostic: 'connection-check-v1', other: 'value' } },
    { query: { diagnostic: null } },
    { url: '/api/me?diagnostic=connection-check-v1', query: { diagnostic: 'other' } },
    { url: '/api/connection-check?diagnostic=other', query: { diagnostic: 'connection-check-v1' } },
  ])('rejects malformed selector without profile fallthrough: %j', async request => {
    const result = await run({ method: 'GET', ...request });
    expect(result.status).toBe(400); expect(result.body).toEqual({ status: 'invalid_diagnostic_selector' });
    expect(verify).not.toHaveBeenCalled();
  });
  it('preserves normal OPTIONS without authentication', async () => {
    expect((await run({ method: 'OPTIONS', url: '/api/me' })).status).toBe(204);
    expect(verify).not.toHaveBeenCalled();
  });
  it('uses only the exact rewrite before the unchanged frontend fallback', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.rewrites).toEqual([
      { source: '/api/connection-check', destination: '/api/me?diagnostic=connection-check-v1' },
      { source: '/((?!api/).*)', destination: '/index.html' },
    ]);
  });
  it('keeps the full relative CRM dependency closure within admin', () => {
    const root = resolve('.'); const visited = new Set();
    function check(file) {
      if (visited.has(file)) return;
      visited.add(file);
      expect(relative(root, file).startsWith('..')).toBe(false);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
        check(resolve(dirname(file), match[1]));
      }
    }
    check(resolve('api/me.js'));
    expect(visited.has(resolve('api/_lib/connectionCheck.js'))).toBe(true);
    expect(visited.has(resolve('api/_lib/connectionCheckHandler.js'))).toBe(true);
  });
});
