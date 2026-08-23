import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EotQuoteWizard from './EotQuoteWizard';

// Proves the geometry predicate QuoteCalculator relies on to hand the
// generic mobile dock off to this wizard's own sticky footer — and back
// again — without ever showing both, and without the false positive real-
// Chromium instrumentation found in plain IntersectionObserver.isIntersecting
// (a mid-scroll slice of the footer can technically intersect the full
// viewport while sitting entirely behind the cookie banner, nowhere near its
// sticky-stuck position). See EotQuoteWizard's useReportFooterUsability.

function setFooterRect(bottom: number) {
  const el = screen.getByTestId('footer-nav').parentElement as HTMLElement;
  el.getBoundingClientRect = vi.fn(() => ({
    bottom, top: bottom - 140, left: 0, right: 390, width: 390, height: 140, x: 0, y: bottom - 140,
    toJSON() {},
  })) as unknown as () => DOMRect;
}

describe('EotQuoteWizard — footer usability geometry contract', () => {
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    document.documentElement.style.removeProperty('--vve-cookie-banner-h');
    // requestAnimationFrame coalesces rapid scroll/resize events onto one
    // measurement per frame — jsdom's real rAF is asynchronous, so this
    // stub resolves it on a microtask instead (deterministic and fast,
    // without the ordering hazard of firing the callback *inside* the same
    // call that still has to return and assign the frame id — a synchronous
    // stub was tried first and produced exactly that hazard: the second of
    // two scroll dispatches in one test silently no-op'd because the
    // callback's own `rafId = 0` reset was overwritten immediately
    // afterwards by the outer assignment picking up the stub's return value).
    let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++nextId;
      Promise.resolve().then(() => cb(0));
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    document.documentElement.style.removeProperty('--vve-cookie-banner-h');
    vi.unstubAllGlobals();
  });

  it('reports the initial not-usable measurement synchronously on mount (top-of-page state)', () => {
    const onChange = vi.fn();
    render(<EotQuoteWizard onBook={vi.fn()} onFooterUsableChange={onChange} />);
    // The very first check() call runs directly in the effect body, not
    // through requestAnimationFrame, so this is genuinely synchronous.
    // jsdom's default getBoundingClientRect is all-zero, so rect.bottom (0)
    // fails the `> 0` half of the predicate — correctly matching the real
    // top-of-page case, where the footer sits off-screen below the fold
    // (real-device measurement: footer y=972 against an 844px viewport).
    expect(onChange).toHaveBeenCalledWith(false);
    expect(onChange).not.toHaveBeenCalledWith(true);
  });

  it('reports usable once the footer settles into its sticky-stuck phase, no cookie banner present', async () => {
    const onChange = vi.fn();
    render(<EotQuoteWizard onBook={vi.fn()} onFooterUsableChange={onChange} />);
    onChange.mockClear();
    setFooterRect(727); // real-device measurement: stuck phase, 585.5–727
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
  });

  it('is not fooled by a mid-scroll slice that technically intersects the full viewport behind the cookie banner', async () => {
    const onChange = vi.fn();
    document.documentElement.style.setProperty('--vve-cookie-banner-h', '117px');
    render(<EotQuoteWizard onBook={vi.fn()} onFooterUsableChange={onChange} />);
    onChange.mockClear();
    // Real-device measurement: rect bottom 962.5 against an 844px viewport —
    // technically intersects the *raw* viewport, but usableViewportBottom is
    // 844 - 117 = 727, so a plain isIntersecting check would wrongly hide
    // the generic dock here. This predicate must not.
    setFooterRect(962.5);
    window.dispatchEvent(new Event('scroll'));
    // No transition is expected here — usable was already false at mount
    // (default zeroed rect) and stays false for this rect too, so the
    // dedupe in useReportFooterUsability correctly never re-fires onChange.
    // Flush the scheduled microtask before asserting the negative, so this
    // isn't just passing because the check hasn't run yet.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalledWith(true);
  });

  it('reports usable once stuck directly above a live cookie banner, then not-usable again once fully scrolled past', async () => {
    const onChange = vi.fn();
    document.documentElement.style.setProperty('--vve-cookie-banner-h', '117px');
    render(<EotQuoteWizard onBook={vi.fn()} onFooterUsableChange={onChange} />);
    onChange.mockClear();

    setFooterRect(727); // usableViewportBottom = 844 - 117 = 727 — exactly the stuck boundary
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));

    onChange.mockClear();
    setFooterRect(-50); // scrolled fully past, above the viewport entirely
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });

  it('re-measures when the cookie banner height changes, without a scroll/resize event', async () => {
    const onChange = vi.fn();
    render(<EotQuoteWizard onBook={vi.fn()} onFooterUsableChange={onChange} />);
    setFooterRect(800); // usable against an 844px viewport with no banner (844-0=844 >= 800)
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));

    onChange.mockClear();
    // Banner appears at 100px tall: usableViewportBottom drops to 744, which
    // no longer covers the footer's 800px bottom edge — must flip to false
    // purely from the style-attribute mutation, with no scroll/resize.
    document.documentElement.style.setProperty('--vve-cookie-banner-h', '100px');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });

  it('resets to false on unmount so a later remount never starts stuck-true', async () => {
    const onChange = vi.fn();
    const { unmount } = render(<EotQuoteWizard onBook={vi.fn()} onFooterUsableChange={onChange} />);
    setFooterRect(727);
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));

    onChange.mockClear();
    unmount();
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
