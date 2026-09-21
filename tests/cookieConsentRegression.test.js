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

  it('the private confirmation page loads no Google tag', () => {
    const matches = read('public/confirmation.html').match(GTAG_LOADER) || [];
    expect(matches.length).toBe(0);
  });

  it('the consent default block runs before the gtag.js loader in index.html', () => {
    const source = read('index.html');
    const defaultIdx = source.indexOf("gtag('consent', 'default'");
    const loaderIdx = source.indexOf('googletagmanager.com/gtag/js');
    expect(defaultIdx).toBeGreaterThan(-1);
    expect(defaultIdx).toBeLessThan(loaderIdx);
  });

  it('the four consent signals default to denied on the public site', () => {
    const source = read('index.html');
    const block = source.slice(source.indexOf("gtag('consent', 'default'"), source.indexOf("gtag('consent', 'default'") + 300);
    expect(block).toMatch(/ad_storage:\s*'denied'/);
    expect(block).toMatch(/analytics_storage:\s*'denied'/);
    expect(block).toMatch(/ad_user_data:\s*'denied'/);
    expect(block).toMatch(/ad_personalization:\s*'denied'/);
  });

  it('enables URL passthrough only after denied-by-default consent is established', () => {
    const source = read('index.html');
    const defaultIndex = source.indexOf("gtag('consent', 'default'");
    const passthroughIndex = source.indexOf("gtag('set', 'url_passthrough', true)");
    const configIndex = source.indexOf("gtag('config', 'AW-18214693277')");

    expect(defaultIndex).toBeGreaterThan(-1);
    expect(passthroughIndex).toBeGreaterThan(defaultIndex);
    expect(configIndex).toBeGreaterThan(passthroughIndex);
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

describe('private legacy confirmation page', () => {
  const html = read('public/confirmation.html');

  it('still verifies payment before showing success', () => {
    expect(html).toMatch(/if\s*\(d\.paid\s*===\s*true\)/);
  });

  it('explicitly disables the retired conversion block before it can read URL identifiers', () => {
    const start = html.indexOf('(function () {', html.indexOf('Retired legacy conversion'));
    expect(html.slice(start, start + 40)).toMatch(/\(function \(\) \{\s*return;/);
  });

  it('contains no Google loader and keeps the historic code unreachable', () => {
    expect(html).not.toContain('googletagmanager.com/gtag/js');
    expect(html).toContain('Retired legacy conversion tracking');
  });
});
