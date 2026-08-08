import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(__dirname, '..', relPath), 'utf8'));
}

function findHeaderBlock(config, sourcePattern) {
  return (config.headers || []).find((h) => h.source === sourcePattern);
}

function headerValue(block, key) {
  const entry = (block.headers || []).find((h) => h.key === key);
  return entry ? entry.value : undefined;
}

// SECURITY_AUDIT_REPORT.md finding F3 — the public site previously shipped
// zero HTTP security headers. These are static checks on vercel.json's
// content (there's no way to run a live Vercel deployment in this test
// environment), matching the pattern already used for admin/vercel.json.
describe('public site vercel.json — response headers (F3)', () => {
  const config = readJson('vercel.json');
  const block  = findHeaderBlock(config, '/(.*)');

  it('applies a headers rule to every route (public routes, booking.html, confirmation.html, static assets)', () => {
    expect(block).toBeDefined();
  });

  it('sets X-Content-Type-Options: nosniff', () => {
    expect(headerValue(block, 'X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY (closes the clickjacking gap on the booking/payment funnel)', () => {
    expect(headerValue(block, 'X-Frame-Options')).toBe('DENY');
  });

  it('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
    expect(headerValue(block, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sets a conservative Permissions-Policy disabling unused browser features', () => {
    const value = headerValue(block, 'Permissions-Policy');
    expect(value).toBeDefined();
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(value).toMatch(new RegExp(`${feature}=\\(\\)`));
    }
  });

  it('does not weaken caching on normal public assets (no Cache-Control override added)', () => {
    expect(headerValue(block, 'Cache-Control')).toBeUndefined();
  });

  // Vite writes content-hashed filenames into dist/assets (index-<hash>.js,
  // index-<hash>.css), so their contents can never change under a given URL.
  // Vercel's static default is `public, max-age=0, must-revalidate`, which made
  // the browser revalidate ~765KB of immutable bundle on every navigation. The
  // rule is deliberately scoped to /assets/ — HTML must keep revalidating, or a
  // deploy would not reach visitors who already have the page cached.
  describe('hashed build assets are cached immutably', () => {
    const assetBlock = findHeaderBlock(config, '/assets/(.*)');

    it('has a header rule for /assets/(.*)', () => {
      expect(assetBlock).toBeDefined();
    });

    it('marks them immutable for a year', () => {
      const value = headerValue(assetBlock, 'Cache-Control');
      expect(value).toBe('public, max-age=31536000, immutable');
    });

    it('does not apply the immutable rule to HTML routes', () => {
      // The catch-all block must stay free of Cache-Control so a new deploy is
      // picked up immediately.
      expect(headerValue(block, 'Cache-Control')).toBeUndefined();
    });
  });

  it('does NOT rewrite unmatched paths to index.html', () => {
    // This used to assert the opposite: rewrites: [{ source: '/(.*)',
    // destination: '/index.html' }]. That rule was written for SPA routing, but
    // the site is fully prerendered — every route in AppRoutes has its own
    // dist/<route>/index.html, and Vercel resolves the filesystem before
    // rewrites, so it never applied to a real page.
    //
    // Where it DID apply was every path matching nothing, and there it returned
    // HTTP 200 with the homepage: soft 404s that let Google index unlimited
    // duplicate URLs, hid stale links from visitors, and made a missing asset
    // come back as HTML with a success status instead of an error.
    //
    // Removing it lets Vercel serve dist/404.html with a genuine 404 status.
    expect(config.rewrites ?? []).toEqual([]);
    expect(JSON.stringify(config)).not.toContain('/index.html');
  });

  it('pins clean-URL and trailing-slash behaviour rather than relying on defaults', () => {
    expect(config.cleanUrls).toBe(false);
    expect(config.trailingSlash).toBe(false);
  });

  it('redirects the retired legacy booking file without shadowing /booking', () => {
    expect(config.redirects).toContainEqual({
      source: '/booking.html',
      destination: '/booking',
      permanent: true,
    });
    expect(existsSync(resolve(__dirname, '..', 'public', 'booking.html'))).toBe(false);
  });

  it('does not add a Content-Security-Policy header (deferred — see CSP_IMPLEMENTATION_NOTES.md)', () => {
    expect(headerValue(block, 'Content-Security-Policy')).toBeUndefined();
  });

  it('is valid, parseable JSON', () => {
    expect(() => readJson('vercel.json')).not.toThrow();
  });
});

describe('admin site vercel.json — unaffected by the F3 change', () => {
  const adminConfig = readJson('admin/vercel.json');
  const adminBlock  = findHeaderBlock(adminConfig, '/(.*)');

  it('still has its own Content-Security-Policy (admin app is out of scope for this branch)', () => {
    expect(headerValue(adminBlock, 'Content-Security-Policy')).toBeDefined();
  });

  it('still has its own X-Frame-Options: DENY', () => {
    expect(headerValue(adminBlock, 'X-Frame-Options')).toBe('DENY');
  });
});
