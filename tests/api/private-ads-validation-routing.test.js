import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const privateHandler = vi.hoisted(() => vi.fn((_req, res) => res.end('PRIVATE')));
const preview = vi.hoisted(() => vi.fn(() => false));
const requireJourney = vi.hoisted(() => vi.fn(() => { throw new Error('STOP-ORDINARY-TEST'); }));
vi.mock('../../api/_lib/privateAdsValidation.js', () => ({ default: privateHandler }));
vi.mock('../../api/_lib/previewIsolation.js', () => ({ rejectUnsafePreview: preview }));
vi.mock('../../admin/api/_lib/bookingJourney.js', () => ({ requireJourneyEnabled: requireJourney,
  loadPrivateJourney: vi.fn(), publicJourney: vi.fn(), performCustomerAction: vi.fn(), JourneyError: class extends Error {} }));
vi.mock('../../api/_lib/bookingJourneyWorker.js', () => ({ processDueBookingJourneys: vi.fn() }));
vi.mock('../../admin/api/_lib/bookingReadiness.js', () => ({ bookingReadiness: vi.fn(), isBookingWorker: vi.fn() }));
import handler from '../../api/booking-management.js';
const response = () => ({ writeHead: vi.fn(), end: vi.fn() });
describe('private routing isolation', () => {
  it.each(['/api/admin-ads-validation', '/api/booking-management?resource=admin-ads-validation',
    '/api/admin-ads-validation#bad', '/x/../api/admin-ads-validation'])('dispatches %s without business fallthrough', async url => {
    vi.clearAllMocks(); const res = response(); await handler({ url, method: 'POST', headers: {} }, res);
    expect(privateHandler).toHaveBeenCalledTimes(1); expect(preview).not.toHaveBeenCalled(); expect(requireJourney).not.toHaveBeenCalled();
  });
  it('ordinary booking path retains its existing guard and handler flow', async () => {
    vi.clearAllMocks(); await handler({ url: '/api/booking-management', method: 'GET', headers: {} }, response());
    expect(privateHandler).not.toHaveBeenCalled(); expect(preview).toHaveBeenCalledTimes(1); expect(requireJourney).toHaveBeenCalledTimes(1);
  });
  it('exact rewrites reuse existing function allocations and never restore connection-check', () => {
    for (const [path, target] of [['vercel.json', '/api/booking-management?resource=admin-ads-validation'],
      ['admin/vercel.json', '/api/me?resource=admin-ads-validation']]) {
      const config = JSON.parse(readFileSync(path, 'utf8'));
      expect(config.rewrites.filter(row => row.source === '/api/admin-ads-validation')).toEqual([
        { source: '/api/admin-ads-validation', destination: target },
      ]);
      expect(JSON.stringify(config)).not.toContain('connection-check');
    }
  });
});
