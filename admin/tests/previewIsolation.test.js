import { afterEach, describe, expect, it, vi } from 'vitest';
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
import { verifyAdminRequest, verifyMediaAdminRequest } from '../api/_lib/adminAuth.js';
import { enquiriesHandler } from '../api/_lib/enquiries.js';
import { websitePricebookHandler } from '../api/_lib/websitePricebookActions.js';
import { mediaCollectionHandler } from '../api/_lib/mediaCollectionActions.js';
import { mediaAssetHandler } from '../api/_lib/mediaAssetActions.js';
import { handleBookingJourney } from '../api/_lib/bookingJourneyAction.js';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('CRM previews cannot use inherited active credentials', () => {
  it.each([verifyAdminRequest, verifyMediaAdminRequest])('blocks the shared auth boundary before any database call', async verify => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VVE_PREVIEW_ISOLATION_APPROVED', '');
    const result = await verify({ headers: { authorization: 'Bearer synthetic' } });
    expect(result).toMatchObject({ ok: false, status: 403 }); expect(createClient).not.toHaveBeenCalled();
  });
  it.each([['enquiries', enquiriesHandler], ['pricebook', websitePricebookHandler], ['upload', mediaCollectionHandler], ['media publishing', mediaAssetHandler], ['booking journey', handleBookingJourney]])('blocks %s mutations before authentication or provider actions', async (_name, handler) => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VVE_PREVIEW_ISOLATION_APPROVED', '');
    const req = { method: 'POST', url: '/api/search', headers: {}, query: {}, on: vi.fn() };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    await handler(req, res, {});
    expect(res.writeHead.mock.calls[0][0]).toBe(403); expect(createClient).not.toHaveBeenCalled(); expect(req.on).not.toHaveBeenCalled();
  });
});
