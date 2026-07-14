import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('still rewrites every route to index.html (SPA routing unchanged)', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
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
