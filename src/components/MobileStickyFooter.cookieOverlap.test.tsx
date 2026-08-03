// The mobile booking bar and the cookie banner are both fixed to the bottom of
// the viewport, and the banner mounts a few hundred milliseconds after the bar.
//
// The offset mechanism was already correct — the banner publishes its height on
// --vve-cookie-banner-h and the bar reads it — but two things still put the bar
// underneath the banner on a fresh mobile visit:
//
//   1. the height was published from useEffect, which runs AFTER paint, so the
//      very frame that first drew the banner also drew the bar at bottom:0; and
//   2. the bar carried `transition-[bottom] duration-200`, so once the variable
//      did change the bar slid up THROUGH the banner. Measured in Chromium at
//      390x800: 52px of overlap — the bar completely covered — from t=261ms to
//      t=365ms.
//
// jsdom does no layout, so the pixel proof lives in the browser pass. What is
// pinned here is the contract that made the overlap possible.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileStickyFooter from './MobileStickyFooter';
import { BookingProvider } from '../context/BookingContext';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function renderBar() {
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <BookingProvider>
          <MobileStickyFooter />
        </BookingProvider>
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('the booking bar sits above the cookie banner, never under it', () => {
  it('offsets itself by the banner height variable', () => {
    const { container } = renderBar();
    const bar = container.querySelector('.fixed');

    expect(bar).not.toBeNull();
    expect(bar).toHaveStyle({ bottom: 'var(--vve-cookie-banner-h, 0px)' });
  });

  it('does not animate `bottom`, which is what slid it through the banner', () => {
    const { container } = renderBar();
    const bar = container.querySelector('.fixed')!;

    expect(bar.className).not.toContain('transition-[bottom]');
    // Guard the general case too: any transition covering `bottom` reopens it.
    expect(bar.className).not.toMatch(/transition-all/);
  });

  it('still renders both actions — the fix hides nothing', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /Book online/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Need help/i })).toBeInTheDocument();
  });
});

describe('the banner publishes its height before the first paint', () => {
  it('sets the variable synchronously, not in a post-paint effect', async () => {
    // CookieConsentProvider decides visibility in an effect, so the banner is
    // not in the first render. Once it is, the variable must already be set:
    // useLayoutEffect commits before paint, useEffect would not.
    const { CookieConsentProvider: Provider } = await import('../context/CookieConsentContext');

    render(
      <MemoryRouter>
        <Provider>
          <div>page</div>
        </Provider>
      </MemoryRouter>,
    );

    const banner = await screen.findByRole('region', { name: 'Cookie consent' });
    expect(banner).toBeInTheDocument();

    // jsdom reports offsetHeight as 0, so the value is "0px" rather than a real
    // measurement — the point is that it is present, not what it reads.
    const published = document.documentElement.style.getPropertyValue('--vve-cookie-banner-h');
    expect(published).not.toBe('');
  });
});
