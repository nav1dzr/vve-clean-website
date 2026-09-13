import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), preload: vi.fn(), render: vi.fn(), createRoot: vi.fn() }));
vi.mock('./lib/websitePricebook', () => ({ loadWebsitePricebook: mocks.load }));
vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }));
vi.mock('./App.tsx', () => ({ default: () => null }));
vi.mock('./clientRoutePages', () => ({ preloadClientRoute: mocks.preload }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="root"></div>';
  mocks.createRoot.mockReturnValue({ render: mocks.render });
  mocks.preload.mockResolvedValue(undefined);
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
    expect(mocks.preload).toHaveBeenCalledWith('/carpet-cleaning-london');
    expect(mocks.load.mock.invocationCallOrder[0]).toBeLessThan(mocks.preload.mock.invocationCallOrder[0]);
    expect(mocks.preload.mock.invocationCallOrder[0]).toBeLessThan(mocks.render.mock.invocationCallOrder[0]);
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


describe('initial split-page startup', () => {
  it('keeps prerendered content until the initial page has loaded', async () => {
    let release!: () => void;
    mocks.preload.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    document.getElementById('root')!.innerHTML = '<main><h1>Prerendered service content</h1></main>';
    await import('./main');
    await vi.waitFor(() => expect(mocks.preload).toHaveBeenCalledOnce());
    expect(mocks.createRoot).not.toHaveBeenCalled();
    expect(document.querySelector('h1')).toHaveTextContent('Prerendered service content');
    release();
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
  });

  it('describes an initial page-chunk failure accurately instead of blaming the price list', async () => {
    mocks.preload.mockRejectedValue(new Error('Page download failed'));
    await import('./main');
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    const recovery = mocks.render.mock.calls[0][0];
    expect(recovery.type).toBe('main');
    expect(recovery.props.children[0].props.children).toBe('This page couldn’t load');
    expect(window.__VVE_PRICEBOOK__?.version).toBe('published');
  });
});
