import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GTAG_LOADER = /googletagmanager\.com\/gtag\/js\?id=AW-18214693277/g;

function read(relPath) {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

describe('cookie consent — the Google tag is not duplicated', () => {
  it('index.html loads the gtag.js script exactly once', () => {
    const matches = read('index.html').match(GTAG_LOADER) || [];
    expect(matches.length).toBe(1);
  });

  it('confirmation.html loads the gtag.js script exactly once', () => {
    const matches = read('public/confirmation.html').match(GTAG_LOADER) || [];
    expect(matches.length).toBe(1);
  });

  it('the consent default block runs before the gtag.js loader in index.html', () => {
    const source = read('index.html');
    const defaultIdx = source.indexOf("gtag('consent', 'default'");
    const loaderIdx = source.indexOf('googletagmanager.com/gtag/js');
    expect(defaultIdx).toBeGreaterThan(-1);
    expect(defaultIdx).toBeLessThan(loaderIdx);
  });

  it('the consent default block runs before the gtag.js loader in confirmation.html', () => {
    const source = read('public/confirmation.html');
    const defaultIdx = source.indexOf("gtag('consent', 'default'");
    const loaderIdx = source.indexOf('googletagmanager.com/gtag/js');
    expect(defaultIdx).toBeGreaterThan(-1);
    expect(defaultIdx).toBeLessThan(loaderIdx);
  });

  it('the four consent signals default to denied in both entry points', () => {
    for (const file of ['index.html', 'public/confirmation.html']) {
      const source = read(file);
      const block = source.slice(source.indexOf("gtag('consent', 'default'"), source.indexOf("gtag('consent', 'default'") + 300);
      expect(block).toMatch(/ad_storage:\s*'denied'/);
      expect(block).toMatch(/analytics_storage:\s*'denied'/);
      expect(block).toMatch(/ad_user_data:\s*'denied'/);
      expect(block).toMatch(/ad_personalization:\s*'denied'/);
    }
  });

  it('no React component injects a second gtag.js script tag', () => {
    // The banner/modal/context are the only new client code touching consent
    // — confirm none of them reference the gtag loader URL or inject <script>.
    const files = [
      'src/context/CookieConsentContext.tsx',
      'src/components/CookieConsentBanner.tsx',
      'src/components/CookieSettingsModal.tsx',
      'src/lib/consent.ts',
    ];
    for (const file of files) {
      const source = read(file);
      expect(source).not.toMatch(/googletagmanager\.com/);
      expect(source).not.toMatch(/createElement\(['"]script['"]\)/);
    }
  });
});

describe('cookie consent — the paid-booking conversion pipeline is untouched', () => {
  const html = read('public/confirmation.html');

  it('still gates conversions on a verified server payment response (paid === true)', () => {
    expect(html).toMatch(/if\s*\(\s*!data\.paid\s*\)/);
  });

  it('still requires livemode === true and the exact production hostname', () => {
    expect(html).toMatch(/var\s+PROD_HOST\s*=\s*"www\.vveclean\.co\.uk"/);
    expect(html).toMatch(/data\.livemode\s*===\s*true/);
    expect(html).toMatch(/location\.hostname\s*===\s*PROD_HOST/);
  });

  it('still uses the exact conversion label AW-18214693277/hUwdCK68gswcEJ3TuO1D', () => {
    expect(html).toMatch(/var\s+SEND_TO\s*=\s*"AW-18214693277\/hUwdCK68gswcEJ3TuO1D"/);
  });

  it('still deduplicates by transaction id before firing, and only marks it fired after the hit is confirmed', () => {
    expect(html).toMatch(/var\s+dedupSet\s*=\s*storageKey\s*\?\s*!!localStorage\.getItem\(storageKey\)\s*:\s*false/);
    expect(html).toMatch(/if\s*\(\s*dedupSet\s*\)\s*\{/);
    expect(html).toMatch(/localStorage\.setItem\(storageKey,\s*"1"\)/);
  });

  it('does not gate the conversion fetch/fire itself on the new cookie-consent state', () => {
    // Consent Mode governs what gtag.js stores/sends under the hood; our own
    // JS must not add a second, redundant "if consent denied, skip" branch
    // around the existing verified-payment gating. The block already had one
    // pre-existing, unconditional diagnostic console.log reading vve_consent
    // (never used to gate anything) — confirm that's still the only mention.
    const conversionBlock = html.slice(html.indexOf('Conversion tracking'), html.indexOf('</script>', html.indexOf('Conversion tracking')));
    const mentions = conversionBlock.match(/vve_consent/g) || [];
    expect(mentions.length).toBe(1);
    expect(conversionBlock).toMatch(/console\.log\("\[VVE conv\] consent state\s*:"\s*,\s*cs\)/);
  });
});
