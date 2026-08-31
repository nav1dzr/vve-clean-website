import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// §11 audit, kept as a test rather than a one-off report so it stays true.
//
// Two rules:
//   1. A page that renders MobileStickyFooter must also reserve room for it
//      with `mobile-page-bottom` (height + safe-area inset). A flat `pb-[56px]`
//      is not enough — the bar adds the inset to its own height, so on a phone
//      with a home indicator the last ~34px of the page sits underneath it.
//   2. A page that deliberately suppresses the bar must still offer the
//      visitor a primary action.

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '../pages');
const componentsDir = here;

const read = (dir: string, file: string) => readFileSync(resolve(dir, file), 'utf8');

const pageFiles = readdirSync(pagesDir).filter(
  (f) => f.endsWith('.tsx') && !f.includes('.test.'),
);

/** Layout components that render the bar on behalf of the pages using them. */
const LAYOUTS_WITH_BAR = ['ServiceLandingLayout.tsx', 'BlogPostLayout.tsx'].filter((f) =>
  read(componentsDir, f).includes('<MobileStickyFooter'),
);

function rendersBar(source: string): boolean {
  if (source.includes('<MobileStickyFooter')) return true;
  return LAYOUTS_WITH_BAR.some((layout) => source.includes(layout.replace('.tsx', '')));
}

// Pages that intentionally do not render the shared bar, each with the
// primary action they offer instead. Adding a page here is a deliberate
// decision, not a way to silence the test — the second assertion still
// requires a real CTA.
const INTENTIONAL_SUPPRESSIONS: Record<string, RegExp> = {
  // Owns the payment button itself; a second booking CTA would compete with it.
  'BookingPage.tsx': /Send request — no payment/,
  // Sets state 'hidden' via BookingContext and renders its own fixed bar.
  'LeafletPage.tsx': /wa\.me|tel:/,
  // Not a conversion page; offers a route back plus a quote link.
  'NotFoundPage.tsx': /to="\/#quote"/,
  // These pages render their own two-up bar. Pricing uses price + WhatsApp;
  // legal pages keep call + WhatsApp. The markup is asserted below so the
  // variants cannot silently drift.
  'PricingPage.tsx': /fixed bottom-0[\s\S]*?lg:hidden/,
  'PrivacyPolicyPage.tsx': /fixed bottom-0[\s\S]*?lg:hidden/,
  'TermsOfServicePage.tsx': /fixed bottom-0[\s\S]*?lg:hidden/,
};

/** Pages carrying their own fixed bottom bar instead of the shared one. */
const CUSTOM_BAR_PAGES = ['PricingPage.tsx', 'PrivacyPolicyPage.tsx', 'TermsOfServicePage.tsx'];

describe('§11 — mobile sticky action bar coverage', () => {
  it('finds the layouts that render the bar for their pages', () => {
    expect(LAYOUTS_WITH_BAR.length).toBeGreaterThan(0);
  });

  it.each(pageFiles)('%s either shows the bar or has a stated primary action', (file) => {
    const source = read(pagesDir, file);

    if (rendersBar(source)) return;

    const expectedCta = INTENTIONAL_SUPPRESSIONS[file];
    expect(
      expectedCta,
      `${file} renders no sticky bar and is not listed as an intentional ` +
        'suppression. Either render <MobileStickyFooter /> or add it to ' +
        'INTENTIONAL_SUPPRESSIONS with the CTA it offers instead.',
    ).toBeDefined();
    expect(source, `${file} suppresses the bar but has no primary action`).toMatch(expectedCta);
  });

  it.each(pageFiles)('%s reserves safe-area room whenever it renders the bar', (file) => {
    const source = read(pagesDir, file);
    if (!source.includes('<MobileStickyFooter')) return;

    expect(
      source,
      `${file} renders the sticky bar without 'mobile-page-bottom', so its ` +
        'last content sits under the bar on a phone with a home indicator.',
    ).toContain('mobile-page-bottom');
    // A flat pixel pad ignores env(safe-area-inset-bottom).
    expect(source, `${file} uses a flat bottom pad instead of the safe-area utility`)
      .not.toMatch(/pb-\[56px\]/);
  });
});

describe('§11 — hand-rolled bars meet the same standards as the shared one', () => {
  it.each(CUSTOM_BAR_PAGES)('%s hides its bar on desktop', (file) => {
    expect(read(pagesDir, file)).toMatch(/fixed bottom-0[\s\S]{0,200}lg:hidden/);
  });

  it.each(CUSTOM_BAR_PAGES)('%s sits above the cookie banner', (file) => {
    expect(read(pagesDir, file)).toContain('var(--vve-cookie-banner-h');
  });

  it.each(CUSTOM_BAR_PAGES)('%s reserves room so no content hides behind it', (file) => {
    expect(read(pagesDir, file)).toContain('mobile-page-bottom');
  });

  it.each(CUSTOM_BAR_PAGES)('%s does not use the rejected dark navy treatment', (file) => {
    const bar = read(pagesDir, file).match(/fixed bottom-0[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(bar).not.toMatch(/bg-navy-9|#020b24/i);
  });

  it.each(CUSTOM_BAR_PAGES)('%s offers a reachable primary action', (file) => {
    const source = read(pagesDir, file);
    if (file === 'PricingPage.tsx') expect(source).toMatch(/to="\/#quote"/);
    else expect(source).toMatch(/tel:02080502233/);
    expect(source).toMatch(/wa\.me\/447845451111/);
  });

  it('gives the pricing page a wider, accessible price action and a secondary WhatsApp action', () => {
    const source = read(pagesDir, 'PricingPage.tsx');
    expect(source).toContain('flex-[1.6]');
    expect(source).toContain('bg-sky-500');
    expect(source).toContain('bg-[#25d366]');
    expect(source).not.toMatch(/bg-\[#25d366\][^\n]*text-white/);
  });
});

describe('§11 — the approved bar treatment is intact', () => {
  const source = read(componentsDir, 'MobileStickyFooter.tsx');

  it('uses the approved lighter blue for the primary action', () => {
    expect(source).toMatch(/bg-sky-500/);
    expect(source).toMatch(/text-navy-950/);
    // The rejected dark navy treatment must not come back.
    expect(source).not.toMatch(/bg-navy-9|#020b24|#10243E/i);
  });

  it('uses the bright green only for WhatsApp', () => {
    expect(source).toContain('#25d366');
    expect(source.match(/#25d366/g)).toHaveLength(1);
  });

  it('gives the primary action more width and uses accessible text contrast', () => {
    expect(source.match(/flex-\[1\.6\]/g)).toHaveLength(2);
    expect(source).toContain('bg-[#25d366]');
    expect(source).not.toMatch(/bg-\[#25d366\][^\n]*text-white/);
  });

  it('uses the request-first CTA vocabulary, never a false booking promise', () => {
    expect(source).toContain('Request a time · no payment');
    expect(source).toContain('Get my price');
    expect(source).not.toMatch(/>\s*Book\s*</);
  });

  it('meets the 48px minimum tap target', () => {
    const targets = source.match(/min-h-\[48px\]/g) ?? [];
    expect(targets.length).toBeGreaterThanOrEqual(3);
  });

  it('respects the safe area and stays off desktop', () => {
    expect(source).toContain('env(safe-area-inset-bottom');
    expect(source).toContain('lg:hidden');
  });

  it('sits above the cookie banner rather than under it', () => {
    expect(source).toContain('var(--vve-cookie-banner-h');
  });

  it('renders nothing in the hidden state, for pages owning their own bar', () => {
    expect(source).toMatch(/state === 'hidden'\) return null/);
  });
});
