import { useEffect, act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MobileActionDock, { DOCK_HEIGHT_VAR } from './MobileActionDock';
import { BookingProvider, useBookingCtx, type StickyState } from '../context/BookingContext';
import { CookieConsentProvider } from '../context/CookieConsentContext';
import { CONTACT_PHONE_TEL } from '../data/contactDetails';

// Drives BookingContext to a given sticky state without going through the
// full QuoteCalculator. setCtx is called from a *useEffect*, not during
// StateSetter's own render — calling an ancestor's setState synchronously
// inside a different component's render body only schedules the update for
// a later pass, so MobileActionDock's very first render (in the same act()
// batch as this render() call) was still reading the stale default 'none'
// state. Because setCtx (from useState) is a stable function reference and
// this fires from an effect (runs once, after the initial commit), the
// assertions below use findBy/waitFor to await that one extra render.
function StateSetter({ state, waLink = '' }: { state: StickyState; waLink?: string }) {
  const { setCtx } = useBookingCtx();
  useEffect(() => {
    setCtx({ state, price: 100, waLink, onBook: () => {} });
  }, [state, waLink, setCtx]);
  return null;
}

function renderCalculator(state: StickyState, waLink = '', props: Partial<React.ComponentProps<typeof MobileActionDock>> = {}) {
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <BookingProvider>
          <StateSetter state={state} waLink={waLink} />
          <MobileActionDock variant="calculator" {...(props as object)} />
        </BookingProvider>
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

function renderGeneral(props: Partial<React.ComponentProps<typeof MobileActionDock>> = {}) {
  return render(
    <MemoryRouter>
      <CookieConsentProvider>
        <MobileActionDock
          variant="general"
          analyticsLocation="test_page_dock"
          whatsappText="Hi VVE Clean, test message."
          {...(props as object)}
        />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

describe('MobileActionDock — semantics, offset and safe-area contract', () => {
  it('exposes a single "Quick actions" nav landmark', async () => {
    renderCalculator('none');
    expect(await screen.findByRole('navigation', { name: 'Quick actions' })).toBeInTheDocument();
  });

  it('offsets itself by the cookie-banner height variable and never animates `bottom`', async () => {
    renderCalculator('none');
    const nav = await screen.findByRole('navigation', { name: 'Quick actions' });
    expect(nav).toHaveStyle({ bottom: 'var(--vve-cookie-banner-h, 0px)' });
    expect(nav.className).not.toMatch(/transition-\[bottom\]/);
    expect(nav.className).not.toMatch(/transition-all/);
  });

  it('is hidden on desktop widths via the lg breakpoint utility, not a media-query guess', async () => {
    renderCalculator('none');
    const nav = await screen.findByRole('navigation', { name: 'Quick actions' });
    expect(nav).toHaveClass('lg:hidden');
  });

  it('every action meets the 44px minimum touch target and there is spacing between them', async () => {
    renderCalculator('none');
    const nav = await screen.findByRole('navigation', { name: 'Quick actions' });
    for (const el of nav.querySelectorAll('a, button')) {
      expect(el.className).toMatch(/min-h-\[48px\]/);
    }
    const row = nav.querySelector('.gap-2');
    expect(row).not.toBeNull();
  });

  it('publishes its rendered height on --vve-dock-h and removes it on unmount', async () => {
    const { unmount } = renderCalculator('none');
    await screen.findByRole('navigation', { name: 'Quick actions' });
    // jsdom reports offsetHeight as 0 (no real layout), so the value is
    // "0px" rather than a genuine measurement — mirrors the identical,
    // already-established assertion for --vve-cookie-banner-h. The point is
    // that page bottom-padding has something real to read, not what it reads.
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(DOCK_HEIGHT_VAR)).not.toBe('');
    });
    unmount();
    expect(document.documentElement.style.getPropertyValue(DOCK_HEIGHT_VAR)).toBe('');
  });
});

describe('MobileActionDock — WCAG AA contrast tokens', () => {
  // Actual contrast (computed against the real rendered hex values, not
  // assumed): white on royal-500 (#0ea5e9) is ~2.77:1 and fails; white on
  // royal-700 (#0369a1) is ~5.93:1 and passes. White on the official
  // WhatsApp green #25d366 is ~1.98:1 and fails; ink (#10243e) on the same
  // green is ~7.88:1 and passes (also across hover ~6.38:1 / active
  // ~5.03:1). These assertions pin the *tokens*, not just a visual check.
  it('primary tone uses the AA-passing royal-700 family, not the failing royal-500', async () => {
    renderCalculator('none');
    const primary = await screen.findByRole('button', { name: /Get a quote/i });
    expect(primary.className).toMatch(/bg-royal-700/);
    expect(primary.className).not.toMatch(/bg-royal-500/);
  });

  it('whatsapp tone keeps the shared .btn-whatsapp background but overrides to ink text for contrast', async () => {
    renderCalculator('none');
    const help = await screen.findByRole('link', { name: /Need help/i });
    expect(help.className).toMatch(/btn-whatsapp/);
    expect(help.className).toMatch(/text-ink/);
  });
});

describe('MobileActionDock — calculator variant states', () => {
  it('"none": offers "Get a quote" and a WhatsApp "Need help?" — two distinct destinations', async () => {
    renderCalculator('none');
    const primary = await screen.findByRole('button', { name: /Get a quote/i });
    const help = screen.getByRole('link', { name: /Need help/i });
    expect(primary).toBeInTheDocument();
    expect(help).toHaveAttribute('href', expect.stringContaining('wa.me'));
  });

  it('"none": visible label is short ("Get a quote" fits unclipped) while the full meaning stays in the accessible name', async () => {
    renderCalculator('none');
    const primary = await screen.findByRole('button', { name: /Get a quote/i });
    expect(primary.textContent).toContain('Get a quote');
  });

  it('"bookable": the primary action honestly distinguishes a booking *request* from a secured slot', async () => {
    renderCalculator('bookable');
    const primary = await screen.findByRole('button', { name: /Submit a booking request.*£30 deposit/i });
    expect(primary).toBeInTheDocument();
    expect(primary.getAttribute('aria-label')).toMatch(/confirmed separately/i);
    // Visible text stays compact so it doesn't clip at 320px — the full
    // honest disclosure lives in the accessible name above.
    expect(primary.textContent).toContain('Book · £30 deposit');
  });

  it('"manual": the primary is the WhatsApp photo-quote action and the secondary is Call — never the same WhatsApp link twice', async () => {
    renderCalculator('manual', 'https://wa.me/447845451111?text=manual-quote');
    const primary = await screen.findByRole('link', { name: /Send photos/i });
    const secondary = screen.getByRole('link', { name: /Call/i });
    expect(primary).toHaveAttribute('href', 'https://wa.me/447845451111?text=manual-quote');
    expect(secondary).toHaveAttribute('href', CONTACT_PHONE_TEL);
    expect(secondary.getAttribute('href')).not.toContain('wa.me');
  });

  it('"hidden": renders nothing — the EOT wizard footer is the usable bottom action surface', async () => {
    const { container } = renderCalculator('hidden');
    await waitFor(() => {
      expect(container.querySelector('[data-testid="mobile-action-dock"]')).not.toBeInTheDocument();
    });
  });

  it('an explicit `hidden` prop always suppresses the bar, regardless of state', async () => {
    const { container } = renderCalculator('bookable', '', { hidden: true });
    await waitFor(() => {
      expect(container.querySelector('[data-testid="mobile-action-dock"]')).not.toBeInTheDocument();
    });
  });

  it('"none": clicking the primary scrolls to and focuses the real quote landmark, without dispatching the old validation event', async () => {
    // scrollToHashTarget reads prefers-reduced-motion via matchMedia, which
    // jsdom does not implement — matches the mocking pattern the utility's
    // own test suite (scrollToHash.test.ts) already establishes.
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const quote = document.createElement('section');
    quote.id = 'quote';
    document.body.appendChild(quote);
    const validateSpy = vi.fn();
    document.addEventListener('vve:validate-book', validateSpy);

    const user = userEvent.setup();
    renderCalculator('none');
    const primary = await screen.findByRole('button', { name: /Get a quote/i });
    await user.click(primary);

    expect(document.activeElement?.id).toBe('quote');
    // The dead custom event this used to fire (carried over from an old
    // "Book online — select a service first" design) must never fire from a
    // pure navigation tap — it manufactured a "please choose a service"
    // error against a visitor who had done nothing wrong.
    expect(validateSpy).not.toHaveBeenCalled();

    document.removeEventListener('vve:validate-book', validateSpy);
    quote.remove();
  });
});

describe('MobileActionDock — general variant', () => {
  it('has a real, working primary destination — never a same-page #quote scroll', () => {
    renderGeneral();
    const primary = screen.getByRole('link', { name: 'Book online' });
    expect(primary).toHaveAttribute('href', '/booking');
  });

  it('keeps the visible primary label short (does not render the long accessible name as visible text)', () => {
    renderGeneral();
    const primary = screen.getByRole('link', { name: 'Book online' });
    expect(primary.textContent).toBe('Book');
  });

  it('keeps the visible WhatsApp label short ("Chat") without losing the accessible name', () => {
    renderGeneral();
    const wa = screen.getByRole('link', { name: /WhatsApp/i });
    expect(wa.textContent).toBe('Chat');
  });

  it('accepts a page-specific primary destination/label without breaking the contract', () => {
    renderGeneral({ primaryHref: '/contact', primaryLabel: 'Book a site visit' } as never);
    expect(screen.getByRole('link', { name: 'Book a site visit' })).toHaveAttribute('href', '/contact');
  });

  it('builds the WhatsApp link from the canonical number, not a hardcoded duplicate', () => {
    renderGeneral();
    const wa = screen.getByRole('link', { name: /WhatsApp/i });
    expect(wa.getAttribute('href')).toContain('https://wa.me/447845451111');
    expect(wa.getAttribute('href')).toContain(encodeURIComponent('Hi VVE Clean, test message.'));
  });

  it('exposes a Call action using the canonical phone number', () => {
    renderGeneral();
    const call = screen.getByRole('link', { name: /Call/i });
    expect(call).toHaveAttribute('href', CONTACT_PHONE_TEL);
  });
});

describe('MobileActionDock — commercial variant', () => {
  it('never attempts a missing #quote scroll — the primary is a genuine WhatsApp enquiry', () => {
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <MobileActionDock
            variant="commercial"
            analyticsLocation="commercial_test_dock"
            waLink="https://wa.me/447845451111?text=commercial-enquiry"
          />
        </CookieConsentProvider>
      </MemoryRouter>,
    );
    const primary = screen.getByRole('link', { name: /site visit/i });
    expect(primary).toHaveAttribute('href', 'https://wa.me/447845451111?text=commercial-enquiry');
    expect(primary.getAttribute('href')).not.toContain('#quote');
    expect(screen.getByRole('link', { name: /Call/i })).toHaveAttribute('href', CONTACT_PHONE_TEL);
  });
});

describe('MobileActionDock — mobile-keyboard/focused-field avoidance', () => {
  it('hides while a real text field outside the dock has focus, and reappears on blur', async () => {
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <input aria-label="outside text field" />
          <MobileActionDock variant="general" analyticsLocation="kb_test_dock" whatsappText="hi" />
        </CookieConsentProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('mobile-action-dock')).toBeInTheDocument();

    const input = screen.getByLabelText('outside text field');
    act(() => { input.focus(); });
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-action-dock')).not.toBeInTheDocument();
    });

    act(() => { input.blur(); });
    await waitFor(() => {
      expect(screen.getByTestId('mobile-action-dock')).toBeInTheDocument();
    });
  });

  it('does not hide itself when focus moves to one of its own actions', () => {
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <MobileActionDock variant="general" analyticsLocation="kb_test_dock_2" whatsappText="hi" />
        </CookieConsentProvider>
      </MemoryRouter>,
    );

    const primary = screen.getByRole('link', { name: 'Book online' });
    act(() => { primary.focus(); });
    // No text field involved, so nothing should ever hide it — assert
    // synchronously-stable presence rather than waiting for an event that
    // shouldn't fire.
    expect(screen.getByTestId('mobile-action-dock')).toBeInTheDocument();
  });

  it('does not select non-text inputs (checkbox/radio/button) as a reason to hide', () => {
    render(
      <MemoryRouter>
        <CookieConsentProvider>
          <input type="checkbox" aria-label="a checkbox" />
          <MobileActionDock variant="general" analyticsLocation="kb_test_dock_3" whatsappText="hi" />
        </CookieConsentProvider>
      </MemoryRouter>,
    );

    const checkbox = screen.getByLabelText('a checkbox');
    act(() => { checkbox.focus(); });
    expect(screen.getByTestId('mobile-action-dock')).toBeInTheDocument();
  });
});
