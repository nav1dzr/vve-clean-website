// Indexing, canonical host, share image and 404 wiring.
//
// None of this is reachable from React state, so nothing else in the suite
// notices when it regresses — and every item here was a real defect:
//
//   - vercel.json rewrote /(.*) to /index.html, so every unknown URL returned
//     HTTP 200 with the homepage (soft 404) and a missing asset came back as
//     HTML instead of an error;
//   - og:image was the 512px app icon, which social platforms rendered as a
//     blank or cropped square;
//   - canonicals pointed at the apex, which 308-redirects to www, costing a
//     hop on every one and splitting signals across two hostnames;
//   - /leaflet (a permanent 20% discount) was fully indexable and competing
//     with the full-price service pages.
//
// These read the real files rather than a copy of the intent.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const indexHtml = read('index.html');
const prerender = read('prerender.mjs');
const vercelJson = JSON.parse(read('vercel.json'));
const appRoutes = read('src/AppRoutes.tsx');

const WWW = 'https://www.vveclean.co.uk';

describe('canonical host', () => {
  it('uses www everywhere in the head template', () => {
    // The apex 308-redirects to www; pointing metadata at it wastes a hop.
    expect(indexHtml).not.toMatch(/https:\/\/vveclean\.co\.uk/);
    expect(indexHtml).toContain(`<meta property="og:url" content="${WWW}"`);
  });

  it('builds canonicals and the sitemap from a www BASE_URL', () => {
    expect(prerender).toContain(`const BASE_URL = '${WWW}'`);
    expect(prerender).not.toMatch(/const BASE_URL = 'https:\/\/vveclean\.co\.uk'/);
  });

  it('points structured data at www', () => {
    expect(indexHtml).toContain(`"url": "${WWW}"`);
    expect(indexHtml).toContain(`"image": "${WWW}/og-image.jpg"`);
  });

  it('describes the homepage the same way in its canonical and in the sitemap', () => {
    // These used to disagree: the canonical was the bare origin and the
    // sitemap <loc> had a trailing slash, i.e. one page advertised under two
    // URL forms. Both are now `${WWW}/`.
    expect(prerender).toContain("route.path === '/' ? '/' : route.path}`");
    expect(prerender).not.toContain("route.path === '/' ? '' : route.path}`");
  });
});

describe('social share image', () => {
  it('ships a real 1200x630 file, not the app icon', () => {
    expect(existsSync(resolve(root, 'public/og-image.jpg'))).toBe(true);
    expect(indexHtml).toContain(`<meta property="og:image" content="${WWW}/og-image.jpg"`);
    expect(indexHtml).not.toMatch(/og:image" content="[^"]*android-chrome/);
  });

  it('declares dimensions and type, which crawlers use to size the preview', () => {
    expect(indexHtml).toContain('<meta property="og:image:width" content="1200"');
    expect(indexHtml).toContain('<meta property="og:image:height" content="630"');
    expect(indexHtml).toContain('<meta property="og:image:type" content="image/jpeg"');
  });

  it('provides the Twitter large-card equivalents', () => {
    expect(indexHtml).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(indexHtml).toContain(`<meta name="twitter:image" content="${WWW}/og-image.jpg"`);
  });

  it('describes the image for people who cannot see it', () => {
    expect(indexHtml).toMatch(/<meta property="og:image:alt" content="[^"]{40,}"/);
  });

  it('re-applies the share image on every prerendered route', () => {
    expect(prerender).toContain('const OG_IMAGE = `${BASE_URL}/og-image.jpg`');
    expect(prerender).toContain('twitter:image');
  });
});

describe('indexing', () => {
  it('does not duplicate stale homepage content in a noscript block', () => {
    // Every route is server-rendered during the production build. A global
    // noscript fallback would therefore add a second H1 and stale homepage
    // pricing to every prerendered page.
    expect(indexHtml).not.toContain('<noscript>');
  });

  it('defaults the template to indexable', () => {
    expect(indexHtml).toContain('<meta name="robots" content="index, follow" />');
  });

  it('marks /leaflet noindex, follow', () => {
    // A permanently discounted page must not compete in organic search with the
    // full-price service pages. `follow` keeps its outbound links useful.
    const leaflet = prerender.slice(
      prerender.indexOf("path: '/leaflet'"),
      prerender.indexOf("path: '/carpet-cleaning-london'"),
    );
    expect(leaflet).toContain("robots: 'noindex, follow'");
  });

  it('keeps the service and content pages indexable', () => {
    for (const route of [
      '/carpet-cleaning-london',
      '/sofa-cleaning-london',
      '/end-of-tenancy-cleaning-london',
      '/after-builders-cleaning-london',
      '/commercial-carpet-cleaning-london',
      '/gallery',
      '/pricing',
    ]) {
      const start = prerender.indexOf(`path: '${route}'`);
      expect(start, `${route} is missing from prerender.mjs`).toBeGreaterThan(-1);
      const block = prerender.slice(start, start + 900);
      expect(block, `${route} must not be noindex`).not.toContain('noindex');
    }
  });

  it('marks the 404 page noindex', () => {
    const block = prerender.slice(prerender.indexOf('const notFoundRoute'));
    expect(block).toContain("robots: 'noindex, follow'");
  });
});

describe('404 handling', () => {
  it('no longer rewrites unmatched paths to the homepage', () => {
    // This single rule was the whole soft-404 bug.
    expect(vercelJson.rewrites ?? []).toEqual([]);
    expect(JSON.stringify(vercelJson)).not.toContain('/index.html');
  });

  it('keeps the security headers that were alongside it', () => {
    const keys = vercelJson.headers[0].headers.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining([
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]));
  });

  it('writes dist/404.html, which is what makes the status a real 404', () => {
    expect(prerender).toContain("writeFileSync(resolve(distDir, '404.html')");
  });

  it('also renders the branded page for in-app navigation', () => {
    // The React catch-all is the UX half; on its own it would still return 200.
    expect(appRoutes).toContain('path="*"');
    expect(appRoutes).toContain('NotFoundPage');
  });

  it('gives the 404 page no canonical link', () => {
    // A not-found page must not claim to be the canonical version of anything.
    const block = prerender.slice(prerender.indexOf('// ── 404 ──'));
    expect(block).toMatch(/replace\(\/<link rel="canonical"/);
  });
});

describe('sitemap', () => {
  it('is generated from the route list, not hand-maintained', () => {
    // A checked-in file drifts: the old one listed 12 URLs with every lastmod
    // frozen at 2026-07-28.
    expect(existsSync(resolve(root, 'public/sitemap.xml'))).toBe(false);
    expect(prerender).toContain("writeFileSync(resolve(distDir, 'sitemap.xml')");
  });

  it('excludes noindex routes', () => {
    expect(prerender).toContain("routes.filter((r) => (r.robots ?? 'index, follow').startsWith('index'))");
  });

  it('derives lastmod from git rather than a hardcoded date', () => {
    expect(prerender).toContain("execFileSync('git', ['log', '-1', '--format=%cs'");
    expect(prerender).not.toMatch(/<lastmod>20\d\d-\d\d-\d\d<\/lastmod>/);
  });
});

describe('team framing in prerendered metadata', () => {
  // The visible /about copy dropped "Owner-led service", but the og:description
  // in prerender.mjs kept it — invisible to a component test, and the text
  // social platforms and search engines actually quote. VVE Clean is a team,
  // so no route metadata should describe it as one person's operation.
  it('describes VVE Clean as a team, not an owner-led operation', () => {
    expect(prerender).not.toMatch(/owner[-\s]?(led|operated|run)/i);
  });
});

describe('GA4 wiring', () => {
  it('keeps the Ads tag consent-gated without sending a placeholder GA4 request', () => {
    const adsIndex = indexHtml.indexOf("gtag('config', 'AW-18214693277')");
    expect(adsIndex).toBeGreaterThan(-1);
    expect(indexHtml).not.toContain('G-XXXXXXXXXX');

    // Must come after the Consent Mode v2 default-deny block, not before it —
    // otherwise the GA4 config call would fire before consent state exists.
    const consentDefaultIndex = indexHtml.indexOf("gtag('consent', 'default'");
    expect(consentDefaultIndex).toBeGreaterThan(-1);
    expect(adsIndex).toBeGreaterThan(consentDefaultIndex);

    // No second gtag.js loader — GA4 shares the Ads tag's script src.
    expect(indexHtml.match(/googletagmanager\.com\/gtag\/js/g)).toHaveLength(1);
  });
});
