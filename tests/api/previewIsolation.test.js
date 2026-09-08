import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { previewIsolation } from '../../api/_lib/previewIsolation.js';
const { createClient, createTransport } = vi.hoisted(() => ({ createClient: vi.fn(), createTransport: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('nodemailer', () => ({ default: { createTransport } }));
const publicRoutes = ['contact','create-booking-request','booking-management','create-checkout-session','stripe-webhook','backfill-paid-booking','confirmation-details','verify-payment'];
const handlers = await Promise.all(publicRoutes.map(async name => [name, (await import(`../../api/${name}.js`)).default]));
const ref = 'stageisolatedproject';
const approved = { VERCEL: '1', VERCEL_ENV: 'preview', VVE_PREVIEW_ISOLATION_APPROVED: 'true', VVE_PREVIEW_SUPABASE_PROJECT_REF: ref, VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VVE_PREVIEW_TEST_EMAIL: 'preview@example.com' };
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('preview isolation boundary', () => {
  it('keeps deployment-local helper copies identical', () => {
    expect(readFileSync(resolve('api/_lib/previewIsolation.js'), 'utf8').replace(/\r\n/g, '\n')).toBe(readFileSync(resolve('admin/api/_lib/previewIsolation.js'), 'utf8').replace(/\r\n/g, '\n'));
  });
  it('keeps production and undefined unhosted environments compatible', () => {
    expect(previewIsolation({ VERCEL: '1', VERCEL_ENV: 'production' }).ok).toBe(true);
    expect(previewIsolation({ NODE_ENV: 'test' }).ok).toBe(true);
  });
  it('does not confuse NODE_ENV=production with a production deployment', () => {
    expect(previewIsolation({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }).ok).toBe(false);
    expect(previewIsolation({ VERCEL: '1' }).ok).toBe(false);
    expect(previewIsolation({ VERCEL_ENV: 'development' }).ok).toBe(false);
  });
  it('requires explicit approval of an exact isolated database', () => {
    expect(previewIsolation(approved)).toMatchObject({ ok: true, preview: true });
    for (const changed of [
      { VVE_PREVIEW_ISOLATION_APPROVED: 'false' }, { VVE_PREVIEW_SUPABASE_PROJECT_REF: '' },
      { VVE_PREVIEW_TEST_EMAIL: '' }, { VVE_PREVIEW_TEST_EMAIL: 'one@example.com,two@example.com' },
      { VITE_SUPABASE_URL: '' }, { VITE_SUPABASE_URL: 'https://different.supabase.co' },
      { SUPABASE_URL: 'https://different.supabase.co' }, { VITE_SUPABASE_URL: `http://${ref}.supabase.co` },
      { STRIPE_SECRET_KEY: 'sk_live_fake' }, { STRIPE_SECRET_KEY: 'rk_live_fake' }, { BOOKING_JOURNEY_MODE: 'live' },
    ]) expect(previewIsolation({ ...approved, ...changed }).ok).toBe(false);
  });
  it.each(handlers.filter(([name]) => ['create-checkout-session','backfill-paid-booking','confirmation-details','verify-payment'].includes(name)))('keeps legacy %s disabled even after isolated preview approval', async (_name, handler) => {
    for (const [key, value] of Object.entries(approved)) vi.stubEnv(key, value);
    const res = { writeHead: vi.fn(), end: vi.fn() };
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.writeHead.mock.calls[0][0]).toBe(403); expect(createClient).not.toHaveBeenCalled();
  });
  it.each(['temlphabsqukkiqmrvhl','spbrstpxrimuuorkbsbo'])('never accepts the active project %s as a preview test database', active => {
    expect(previewIsolation({ ...approved, VVE_PREVIEW_SUPABASE_PROJECT_REF: active, VITE_SUPABASE_URL: `https://${active}.supabase.co` }).ok).toBe(false);
  });
  it.each(handlers)('rejects %s before parsing input or creating a database/email client', async (_name, handler) => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VVE_PREVIEW_ISOLATION_APPROVED', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://temlphabsqukkiqmrvhl.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-never-used');
    const req = { method: 'POST', url: '/api/test', headers: {}, on: vi.fn() };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.objectContaining({ 'Cache-Control': 'no-store' }));
    expect(JSON.parse(res.end.mock.calls[0][0]).error).toContain('isolated test resources');
    expect(req.on).not.toHaveBeenCalled(); expect(createClient).not.toHaveBeenCalled(); expect(createTransport).not.toHaveBeenCalled();
  });
});
