import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), render: vi.fn(), createRoot: vi.fn() }));
vi.mock('./lib/websitePricebook', () => ({ loadWebsitePricebook: mocks.load }));
vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }));
vi.mock('./App.tsx', () => ({ default: () => null }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="root"></div>';
  mocks.createRoot.mockReturnValue({ render: mocks.render });
  mocks.load.mockResolvedValue({ id: 'published', version: 'published', overrides: {} });
});
afterEach(() => {
  window.history.replaceState({}, '', '/');
  delete window.__VVE_PRICEBOOK__;
});

describe('Pricebook startup', () => {
  it.each(['/manage-booking', '/Manage-Booking/', '/%6danage-booking', '/manage-booking/customer'])('keeps private booking management available independently of public prices: %s', async path => {
    window.history.replaceState({}, '', path);
    mocks.load.mockRejectedValue(new Error('Public price service unavailable'));
    await import('./main');
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    expect(mocks.load).not.toHaveBeenCalled();
    expect(window.__VVE_PRICEBOOK__?.version).toBe('bundled');
  });

  it('resolves published prices before rendering the public application', async () => {
    window.history.replaceState({}, '', '/carpet-cleaning-london');
    await import('./main');
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(window.__VVE_PRICEBOOK__?.version).toBe('published');
  });

  it('provides recovery instead of rendering an unverified public price list', async () => {
    window.history.replaceState({}, '', '/pricing');
    mocks.load.mockRejectedValue(new Error('Unavailable'));
    await import('./main');
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    expect(window.__VVE_PRICEBOOK__).toBeUndefined();
    expect(mocks.render.mock.calls[0][0].type).toBe('main');
  });
});
