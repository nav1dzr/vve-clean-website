import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');

// Canonical host. The apex redirects 308 -> www, so every canonical, og:url,
// sitemap <loc> and structured-data URL must already point at www — otherwise
// each one costs a redirect hop and splits signals across two hostnames.
const BASE_URL = 'https://www.vveclean.co.uk';

// 1200x630 branded share card (public/og-image.jpg), built from a real VVE job
// photograph. Replaces the 512px app icon, which social platforms rendered as
// a blank or badly cropped square.
const OG_IMAGE = `${BASE_URL}/og-image.jpg`;
const OG_IMAGE_W = '1200';
const OG_IMAGE_H = '630';

// Per-route lastmod, taken from the last commit that touched the files backing
// that route. Honest by construction: it reports when the page actually
// changed, never an invented date. On a shallow CI clone git can only see one
// commit, so every route falls back to that commit's date — still true (the
// deployed content is that commit), just less granular.
const HEAD_DATE = (() => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: __dirname })
      .toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

function lastModified(sources) {
  if (!sources?.length) return HEAD_DATE;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...sources], {
      cwd: __dirname,
    }).toString().trim();
    return out || HEAD_DATE;
  } catch {
    return HEAD_DATE;
  }
}

const { render, ROUTE_METADATA: routes, NOT_FOUND_METADATA: notFoundRoute } = await import('./dist/server/entry-server.js');
const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

/** Replaces a meta tag's content, or inserts the tag if the template lacks it. */
function setMeta(html, matcher, replacement, insertAfter) {
  if (matcher.test(html)) return html.replace(matcher, replacement);
  return html.replace(insertAfter, `${insertAfter}\n    ${replacement}`);
}

function buildHtml(route, canonical) {
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  route = Object.fromEntries(Object.entries(route).map(([key, value]) =>
    typeof value === 'string' ? [key, escape(value)] : [key, value],
  ));
  const app = render(route.path);
  let output = template.replace('<div id="root"></div>', `<div id="root">${app}</div>`);

  output = output.replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`);
  output = output.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${route.description}"`,
  );

  // The homepage photo is useful only on the homepage. Removing its preload
  // elsewhere avoids downloading a 300KB image that the route never shows.
  if (route.path !== '/') {
    output = output.replace(/\s*<link rel="preload" as="image" href="\/hero-cleaning-1280\.avif"[^>]*>/, '');
  }
  output = output.replace(
    /<meta name="robots" content="[^"]*"/,
    `<meta name="robots" content="${route.robots ?? 'index, follow'}"`,
  );
  output = setMeta(
    output,
    /<meta name="referrer" content="[^"]*"[^>]*>/,
    `<meta name="referrer" content="${route.referrer}" />`,
    '</title>',
  );
  output = output.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${route.ogTitle}"`,
  );
  output = output.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${route.ogDescription}"`,
  );
  output = output.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${canonical}"`,
  );
  output = setMeta(
    output,
    /<meta property="og:image" content="[^"]*"/,
    `<meta property="og:image" content="${OG_IMAGE}"`,
    '<meta property="og:type" content="website" />',
  );
  output = setMeta(
    output,
    /<meta property="og:image:width" content="[^"]*"/,
    `<meta property="og:image:width" content="${OG_IMAGE_W}"`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
  );
  output = setMeta(
    output,
    /<meta property="og:image:height" content="[^"]*"/,
    `<meta property="og:image:height" content="${OG_IMAGE_H}"`,
    `<meta property="og:image:width" content="${OG_IMAGE_W}" />`,
  );
  output = output.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${route.ogTitle}"`,
  );
  output = output.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${route.ogDescription}"`,
  );
  output = output.replace(
    /<meta name="twitter:image" content="[^"]*"/,
    `<meta name="twitter:image" content="${OG_IMAGE}"`,
  );

  if (output.includes('<link rel="canonical"')) {
    output = output.replace(
      /<link rel="canonical" href="[^"]*"[^>]*>/,
      `<link rel="canonical" href="${canonical}" />`,
    );
  } else {
    output = output.replace(
      '</title>',
      `</title>\n    <link rel="canonical" href="${canonical}" />`,
    );
  }

  return output;
}

// ── Prerender every real route ───────────────────────────────────────────────
for (const route of routes) {
  // Homepage canonical is `${BASE_URL}/`, matching its <loc> in the sitemap
  // below. It used to be the bare origin with no trailing slash while the
  // sitemap advertised the slash form — the same page described two ways.
  const canonical = `${BASE_URL}${route.path === '/' ? '/' : route.path}`;
  const output = buildHtml(route, canonical);

  const outPath =
    route.path === '/'
      ? resolve(distDir, 'index.html')
      : resolve(distDir, route.path.slice(1), 'index.html');

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(`Pre-rendered ${route.path}`);
}

// ── 404 ──────────────────────────────────────────────────────────────────────
// No canonical: a not-found page must not claim to be the canonical version of
// anything, and it is noindex regardless.
{
  const output = buildHtml(notFoundRoute, `${BASE_URL}/404`)
    .replace(/<link rel="canonical" href="[^"]*"[^>]*>\s*/, '');
  writeFileSync(resolve(distDir, '404.html'), output);
  console.log('Pre-rendered /404.html');
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
// Generated rather than hand-maintained, so a new route cannot be added without
// appearing here, and lastmod cannot silently rot to a fixed historical date.
// Only indexable routes are listed: /leaflet is noindex, and the 404 page is
// neither indexable nor a real URL.
{
  const indexable = routes.filter((r) => (r.robots ?? 'index, follow').startsWith('index'));
  const urls = indexable
    .map((r) => {
      const loc = `${BASE_URL}${r.path === '/' ? '/' : r.path}`;
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastModified(r.sources)}</lastmod>`,
        `    <changefreq>${r.changefreq ?? 'monthly'}</changefreq>`,
        `    <priority>${r.priority ?? '0.5'}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(resolve(distDir, 'sitemap.xml'), xml);
  console.log(`Generated sitemap.xml (${indexable.length} indexable URLs)`);
}
