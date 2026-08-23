// Proves the EOT dock/wizard-footer handoff is correct in the actual
// prerendered output, not just after client-side hydration. React effects —
// including the one that used to force BookingContext straight to 'hidden'
// for isEot's entire lifetime — never run during renderToString, so this is
// exactly the artifact prerender.mjs writes to dist/*.html and Google first
// sees. It must show a real, truthful action surface (not nothing), and
// never two competing bottom bars.

import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import EndOfTenancyPage from './EndOfTenancyPage';
import LocalEndOfTenancyPage from './LocalEndOfTenancyPage';
import { LOCAL_EOT_AREAS } from '../data/localEotAreas';
import { CookieConsentProvider } from '../context/CookieConsentContext';

function ssr(node: React.ReactElement, url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <CookieConsentProvider>{node}</CookieConsentProvider>
    </StaticRouter>,
  );
}

describe('EOT prerendered output — dock/wizard-footer handoff', () => {
  it('main London EOT route: exactly one dock, the wizard footer also present, no duplicate action surfaces', () => {
    const html = ssr(<EndOfTenancyPage />, '/end-of-tenancy-cleaning-london');

    const dockCount = (html.match(/data-testid="mobile-action-dock"/g) ?? []).length;
    expect(dockCount).toBe(1);

    // The wizard's own sticky footer is always in the DOM (position: sticky
    // means its screen position depends on scroll, not its presence) — this
    // is expected and not a duplication in itself, since the two are never
    // simultaneously the *visible* bottom bar (see the geometry tests).
    expect(html).toContain('data-testid="footer-nav"');

    // The truthful pre-wizard state: effects never run in SSR, so context
    // stays at its default 'none' — the dock must show real "Get a quote"
    // content, not have silently forced itself to a permanently hidden
    // state the way the old `state: isEot ? 'hidden' : ...` did.
    expect(html).toContain('Get a quote');
  });

  it('one local EOT route (Islington): same truthful single-dock, no-duplicate contract', () => {
    const islington = LOCAL_EOT_AREAS.find((a) => a.slug === 'islington') ?? LOCAL_EOT_AREAS[0];
    const html = ssr(<LocalEndOfTenancyPage area={islington} />, islington.path);

    const dockCount = (html.match(/data-testid="mobile-action-dock"/g) ?? []).length;
    expect(dockCount).toBe(1);
    expect(html).toContain('data-testid="footer-nav"');
    expect(html).toContain('Get a quote');
  });
});
