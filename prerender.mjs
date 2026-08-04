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

const routes = [
  {
    path: '/',
    title: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    description:
      'Professional carpet, sofa, upholstery, deep and end of tenancy cleaning across London. Fixed quotes, reliable service and fast booking. Get a free quote today.',
    ogTitle: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    ogDescription:
      'Professional carpet, sofa, upholstery, deep and end of tenancy cleaning across London. Fixed quotes, reliable service and fast booking.',
    changefreq: 'weekly',
    priority: '1.0',
    sources: ['src/pages/HomePage.tsx', 'src/components/Hero.tsx'],
  },
  {
    path: '/pricing',
    title: 'Cleaning Prices London | End of Tenancy & Carpet | VVE Clean',
    description:
      'Fixed cleaning prices across East & North London. End of tenancy from £199, carpet rooms from £50, sofas from £70, move-in from £159, after builders from £249.',
    ogTitle: 'Cleaning Prices London | VVE Clean',
    ogDescription:
      'Fixed cleaning prices for East & North London. End of tenancy from £199, carpet rooms from £50, sofas from £70. No hidden fees.',
    changefreq: 'monthly',
    priority: '0.8',
    sources: ['src/pages/PricingPage.tsx', 'src/data/pricing.ts'],
  },
  {
    path: '/booking',
    title: 'Book Your Clean — VVE Clean London',
    description:
      'Book a professional cleaning service online with VVE Clean. Choose your service, fill in your details and pay a £30 deposit to secure your slot.',
    ogTitle: 'Book a Clean Online | VVE Clean London',
    ogDescription:
      'Book a professional cleaning service online with VVE Clean. Pay a £30 deposit to secure your slot.',
    changefreq: 'monthly',
    priority: '0.6',
    sources: ['src/pages/BookingPage.tsx'],
  },
  {
    path: '/commercial',
    title: 'Commercial & Communal Cleaning London | VVE Clean',
    description:
      'Contract cleaning for offices, shops, cafés and communal areas across East & North London. Free site visit within 48 hours, fixed written quote, monthly invoicing.',
    ogTitle: 'Commercial Cleaning London | VVE Clean',
    ogDescription:
      'Contract cleaning for offices, shops, cafés and communal areas across East & North London. Free site visit, fixed quote, monthly invoicing.',
    changefreq: 'monthly',
    priority: '0.7',
    sources: ['src/pages/CommercialPage.tsx'],
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | VVE Clean London',
    description:
      'How VVE LIMITED (trading as VVE Clean) collects, uses and protects your personal data. Covers bookings, payments, cookies and your rights under UK GDPR.',
    ogTitle: 'Privacy Policy | VVE Clean',
    ogDescription: 'How VVE Clean collects, uses, and protects your personal data.',
    changefreq: 'yearly',
    priority: '0.3',
    sources: ['src/pages/PrivacyPolicyPage.tsx'],
  },
  {
    path: '/terms-of-service',
    title: 'Terms of Service | VVE Clean London',
    description:
      'The terms that apply when you use VVE Clean services in London. Covers bookings, deposits, cancellations, liability, complaints, and payment.',
    ogTitle: 'Terms of Service | VVE Clean',
    ogDescription: 'The terms that apply when you use VVE Clean services in London.',
    changefreq: 'yearly',
    priority: '0.3',
    sources: ['src/pages/TermsOfServicePage.tsx'],
  },
  {
    path: '/leaflet',
    title: 'Leaflet Offer | 20% Off Your First Clean | VVE Clean',
    description:
      'Claim your local VVE Clean leaflet offer. Get 20% off your first carpet, sofa or upholstery clean. No code needed — discount applied automatically.',
    ogTitle: 'Leaflet Offer — 20% Off | VVE Clean',
    ogDescription:
      'Get 20% off your first carpet, sofa or upholstery clean with VVE Clean. No code needed.',
    // A permanently discounted landing page competing in organic search would
    // undercut the full-price service pages for the same queries. It stays
    // fully live and keeps its discount and attribution — it is simply not a
    // search result. `follow` so the links out of it still pass signals.
    robots: 'noindex, follow',
    sources: ['src/pages/LeafletPage.tsx'],
  },
  // ── Service landing pages ──────────────────────────────────────────────────
  {
    path: '/carpet-cleaning-london',
    title: 'Carpet Cleaning London | Steam-Clean & Stain Removal | VVE Clean',
    description:
      'Professional carpet cleaning in London from £50 per room. Hot-water extraction lifts stains, allergens and pet odours, and carpets dry in 2–4 hours.',
    ogTitle: 'Carpet Cleaning London | VVE Clean',
    ogDescription:
      'Professional carpet cleaning from £50 per room. Hot-water extraction removes stains, allergens and pet odours across East and North London.',
    changefreq: 'monthly',
    priority: '0.9',
    sources: ['src/pages/CarpetCleaningPage.tsx'],
  },
  {
    path: '/sofa-cleaning-london',
    title: 'Sofa & Upholstery Cleaning London | VVE Clean',
    description:
      'Professional sofa and upholstery cleaning in London from £75. Hot-water extraction lifts stains, pet hair, odours and allergens from sofas, armchairs and mattresses.',
    ogTitle: 'Sofa & Upholstery Cleaning London | VVE Clean',
    ogDescription:
      'Professional sofa cleaning from £75. Hot-water extraction removes stains, pet hair and odours across East and North London.',
    changefreq: 'monthly',
    priority: '0.8',
    sources: ['src/pages/SofaCleaningPage.tsx'],
  },
  {
    path: '/commercial-carpet-cleaning-london',
    title: 'Commercial Carpet Cleaning London | Offices & Retail | VVE Clean',
    description:
      'Commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits, RAMS available, free site visit and a fixed written quote.',
    ogTitle: 'Commercial Carpet Cleaning London | VVE Clean',
    ogDescription:
      'Commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits, RAMS available, free site visit.',
    changefreq: 'monthly',
    priority: '0.7',
    sources: ['src/pages/CommercialCarpetPage.tsx'],
  },
  {
    path: '/end-of-tenancy-cleaning-london',
    title: 'End of Tenancy Cleaning London | Complete from £199 | VVE Clean',
    description:
      'End of tenancy cleaning in London from £199. 67-point agency checklist, free oven clean, cupboards and internal windows included, with a 72-hour re-clean guarantee.',
    ogTitle: 'End of Tenancy Cleaning London | VVE Clean',
    ogDescription:
      'Complete and Tailored end of tenancy packages from £199, with essential appliances, cupboards and internal windows included as standard.',
    changefreq: 'monthly',
    priority: '0.9',
    sources: ['src/pages/EndOfTenancyPage.tsx'],
  },
  {
    path: '/after-builders-cleaning-london',
    title: 'After Builders Cleaning London | From £249 | VVE Clean',
    description:
      'Post-construction cleaning in London from £249. Fine dust, paint splashes, sticker residue and debris removed, leaving the space move-in ready.',
    ogTitle: 'After Builders Cleaning London | VVE Clean',
    ogDescription:
      'Post-construction cleaning from £249. Fine dust, paint splashes and debris removed. Quote by photo within the hour across East and North London.',
    changefreq: 'monthly',
    priority: '0.8',
    sources: ['src/pages/AfterBuildersPage.tsx'],
  },
  {
    path: '/gallery',
    title: 'Gallery | Real Cleaning Results | VVE Clean',
    description:
      'Browse real end of tenancy, carpet and sofa & upholstery cleaning results from VVE Clean across East and North London.',
    ogTitle: 'Gallery | VVE Clean',
    ogDescription:
      'Real end of tenancy, carpet and sofa & upholstery cleaning results from VVE Clean.',
    changefreq: 'monthly',
    priority: '0.7',
    sources: ['src/pages/GalleryPage.tsx', 'src/data/galleryMedia.ts'],
  },
];

// The 404 page is rendered like any other route, but it is written to
// dist/404.html rather than a directory. Vercel serves that file, with a real
// 404 status, for any path that matches no static file — which is why
// vercel.json no longer rewrites unmatched paths to /index.html.
const notFoundRoute = {
  // Any path that matches no <Route> renders NotFoundPage via path="*".
  path: '/__not-found',
  title: 'Page not found | VVE Clean London',
  description:
    'That page could not be found. Browse VVE Clean services, prices and contact details, or get an instant cleaning quote for East and North London.',
  ogTitle: 'Page not found | VVE Clean',
  ogDescription: 'That page could not be found — get an instant cleaning quote instead.',
  robots: 'noindex, follow',
};

const { render } = await import('./dist/server/entry-server.js');
const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

/** Replaces a meta tag's content, or inserts the tag if the template lacks it. */
function setMeta(html, matcher, replacement, insertAfter) {
  if (matcher.test(html)) return html.replace(matcher, replacement);
  return html.replace(insertAfter, `${insertAfter}\n    ${replacement}`);
}

function buildHtml(route, canonical) {
  const app = render(route.path);
  let output = template.replace('<div id="root"></div>', `<div id="root">${app}</div>`);

  output = output.replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`);
  output = output.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${route.description}"`,
  );
  output = output.replace(
    /<meta name="robots" content="[^"]*"/,
    `<meta name="robots" content="${route.robots ?? 'index, follow'}"`,
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
  const canonical = `${BASE_URL}${route.path === '/' ? '' : route.path}`;
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
