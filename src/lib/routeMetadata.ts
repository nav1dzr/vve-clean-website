import { AREAS } from '../data/areas';
import { BLOG_POSTS } from '../data/blog';
import { areaHasRealProof } from './areaProof';
import {
  CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, EOT_BASE_PRICES_P,
  MOVEIN_BASE_PRICES_P, AFTER_BUILDERS_START_FROM_P,
  EOT_GUARANTEE_APPROVED, EOT_GUARANTEE_HOURS, penceToDisplay,
} from '../data/pricing';

export const METADATA_BASE_URL = 'https://www.vveclean.co.uk';
const SOFA_FROM = penceToDisplay(CARPET_ITEM_PRICES_P.sofa_2);
const CARPET_ROOM = penceToDisplay(CARPET_ITEM_PRICES_P.bedroom);
const CARPET_MIN = penceToDisplay(CARPET_MIN_BOOKING_P);
const EOT_FROM = penceToDisplay(EOT_BASE_PRICES_P.studio);
const MOVE_IN_FROM = penceToDisplay(MOVEIN_BASE_PRICES_P.studio);
const AFTER_BUILDERS_FROM = penceToDisplay(AFTER_BUILDERS_START_FROM_P);
const RECLEAN = EOT_GUARANTEE_APPROVED
  ? `${EOT_GUARANTEE_HOURS / 24}-day re-clean for missed agreed tasks`
  : 'agreed package scope';

type RouteDefinition = {
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  robots?: string;
  changefreq?: string;
  priority?: string;
  sources?: string[];
};
export type RouteMetadata = RouteDefinition & {
  ogTitle: string;
  ogDescription: string;
  robots: string;
  canonical: string | null;
  referrer: string;
};

// Shared by client navigation and the compiled SSR entry used by prerender.
// Prices use the same immutable catalogue snapshot as the page controls.
const routes: RouteDefinition[] = [
  {
    path: '/',
    title: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    description:
      'Carpet, sofa and end of tenancy cleaning across East and North London. Compare prices, see our work and request a preferred cleaning time.',
    ogTitle: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    ogDescription:
      'Carpet, sofa and end of tenancy cleaning across East and North London. Compare prices, see our work and request a preferred cleaning time.',
    changefreq: 'weekly',
    priority: '1.0',
    sources: ['src/pages/HomePage.tsx', 'src/components/Hero.tsx'],
  },
  {
    path: '/pricing',
    title: 'Cleaning Prices London | End of Tenancy & Carpet | VVE Clean',
    description:
      `Studio Complete from ${EOT_FROM}; carpet rooms ${CARPET_ROOM} and 2-seater sofas ${SOFA_FROM}, with a ${CARPET_MIN} visit minimum. Compare inclusions and request your clean.`,
    ogTitle: 'Cleaning Prices London | VVE Clean',
    ogDescription:
      `Compare studio Complete from ${EOT_FROM}, studio move-in from ${MOVE_IN_FROM} and after builders from ${AFTER_BUILDERS_FROM}. See carpet and sofa prices with visit minimums.`,
    changefreq: 'monthly',
    priority: '0.8',
    sources: ['src/pages/PricingPage.tsx', 'src/data/pricing.ts'],
  },
  {
    path: '/booking',
    title: 'Request a Cleaning Time | VVE Clean',
    description:
      'Submit a cleaning booking request with VVE Clean. Choose your service, add your details and request a preferred time with no payment.',
    ogTitle: 'Request a Cleaning Time | VVE Clean',
    ogDescription:
      'Submit a cleaning request online with no payment. VVE Clean checks availability, scope and final price before confirming the appointment.',
    changefreq: 'monthly',
    priority: '0.6',
    sources: ['src/pages/BookingPage.tsx'],
  },
  {
    path: '/commercial',
    title: 'Commercial & Communal Cleaning London | VVE Clean',
    description:
      'Commercial cleaning for offices, shops, cafés and communal areas across East and North London. Request a site review and a written scope and quote.',
    ogTitle: 'Commercial Cleaning London | VVE Clean',
    ogDescription:
      'Cleaning for offices, shops, cafés and communal areas across East and North London. Agree the scope, schedule and payment arrangements in your written quote.',
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
      'The terms that apply when you use VVE Clean services in London. Covers booking requests, confirmation, cancellations, liability, complaints, and payment.',
    ogTitle: 'Terms of Service | VVE Clean',
    ogDescription: 'The terms that apply when you use VVE Clean services in London.',
    changefreq: 'yearly',
    priority: '0.3',
    sources: ['src/pages/TermsOfServicePage.tsx'],
  },
  {
    path: '/manage-booking',
    title: 'Manage your booking | VVE Clean',
    description: 'Your private VVE Clean booking details.',
    robots: 'noindex, nofollow, noarchive',
    sources: ['src/pages/BookingManagementPage.tsx'],
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
      `Carpet cleaning in London: bedrooms from ${CARPET_ROOM} per room, ${CARPET_MIN} visit minimum. Fibre checks, stain assessment and extraction where suitable.`,
    ogTitle: 'Carpet Cleaning London | VVE Clean',
    ogDescription:
      `Carpet bedrooms from ${CARPET_ROOM} per room, ${CARPET_MIN} visit minimum. Fibre checks and hot-water extraction where suitable across East and North London.`,
    changefreq: 'monthly',
    priority: '0.9',
    sources: ['src/pages/CarpetCleaningPage.tsx'],
  },
  {
    path: '/sofa-cleaning-london',
    title: 'Sofa & Upholstery Cleaning London | VVE Clean',
    description:
      `Sofa and upholstery cleaning in London: 2-seater sofa ${SOFA_FROM}, ${CARPET_MIN} visit minimum. Fabric checks and hot-water extraction where suitable.`,
    ogTitle: 'Sofa & Upholstery Cleaning London | VVE Clean',
    ogDescription:
      `Professional sofa cleaning from ${SOFA_FROM} for a 2-seater (${CARPET_MIN} minimum booking). Hot-water extraction across East and North London.`,
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
    title: 'End of Tenancy Cleaning London | VVE Clean',
    description:
      `End of tenancy cleaning in London. Studio flat Complete from ${EOT_FROM} with one bathroom. Compare inclusions and the ${RECLEAN}.`,
    ogTitle: 'End of Tenancy Cleaning London | VVE Clean',
    ogDescription:
      `Studio flat Complete from ${EOT_FROM} with one bathroom; selected-task Tailored is also available. Compare the included work and optional extras.`,
    changefreq: 'monthly',
    priority: '0.9',
    sources: ['src/pages/EndOfTenancyPage.tsx'],
  },
  {
    path: '/after-builders-cleaning-london',
    title: 'After Builders Cleaning London | VVE Clean',
    description:
      `After builders cleaning in London from ${AFTER_BUILDERS_FROM}. Send photos of the dust and residue so we can review the work and confirm a quote.`,
    ogTitle: 'After Builders Cleaning London | VVE Clean',
    ogDescription:
      `After builders cleaning from ${AFTER_BUILDERS_FROM}. Send photos so VVE Clean can review the dust, residue and access, then agree the scope and price.`,
    changefreq: 'monthly',
    priority: '0.8',
    sources: ['src/pages/AfterBuildersPage.tsx'],
  },
  // ── Process pages ───────────────────────────────────────────────────────────
  {
    path: '/how-we-clean-carpets',
    title: 'How We Clean Carpets in London | VVE Clean',
    description: 'How VVE Clean cleans carpets in London — the inspection, pre-treatment and hot-water extraction process, step by step.',
    ogTitle: 'How We Clean Carpets in London | VVE Clean',
    ogDescription: 'The hot-water extraction process behind every VVE Clean carpet clean, step by step.',
    changefreq: 'monthly',
    priority: '0.6',
    sources: ['src/pages/HowWeCleanCarpetsPage.tsx'],
  },
  {
    path: '/how-we-clean-sofas-upholstery',
    title: 'How We Clean Sofas & Upholstery in London | VVE Clean',
    description: 'How VVE Clean cleans sofas and upholstery in London — the fabric test and hot-water extraction process, step by step.',
    ogTitle: 'How We Clean Sofas & Upholstery in London | VVE Clean',
    ogDescription: 'The fabric-test-then-extraction process behind every VVE Clean sofa clean, step by step.',
    changefreq: 'monthly',
    priority: '0.6',
    sources: ['src/pages/HowWeCleanSofasPage.tsx'],
  },
  {
    path: '/how-we-clean-end-of-tenancy',
    title: 'How We Clean End of Tenancy in London | VVE Clean',
    description: `How VVE Clean carries out an end of tenancy clean: room-by-room preparation, package inclusions, final checks and the ${RECLEAN}.`,
    ogTitle: 'How We Clean End of Tenancy in London | VVE Clean',
    ogDescription: 'See how an end of tenancy clean is prepared, carried out and checked against the agreed package inclusions.',
    changefreq: 'monthly',
    priority: '0.6',
    sources: ['src/pages/HowWeCleanEndOfTenancyPage.tsx'],
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
  {
    path: '/about',
    title: 'About VVE Clean | London Cleaning Company',
    description: 'Learn how VVE Clean handles end of tenancy, carpet, upholstery, after-builders and commercial cleaning across London.',
    ogTitle: 'About VVE Clean',
    ogDescription: 'A London cleaning team with visible pricing and direct contact.',
    changefreq: 'monthly',
    priority: '0.6',
    // Previously `noindex, follow` because the page carried a visible
    // team-photo placeholder addressed to whoever was editing the site. That
    // block is gone: the page now states only verifiable facts (services,
    // coverage, insurance, company registration) and makes no team claim, so
    // there is nothing left to withhold from search. Adding an owner-approved
    // photograph later does not change indexability.
    sources: ['src/pages/AboutPage.tsx'],
  },
  {
    path: '/contact',
    title: 'Contact VVE Clean | Call, WhatsApp or Email',
    description: 'Contact VVE Clean about cleaning availability, property access or a quote. Call 020 8050 2233, use WhatsApp or send a message.',
    ogTitle: 'Contact VVE Clean',
    ogDescription: 'Call, WhatsApp or email VVE Clean about a London cleaning booking.',
    changefreq: 'monthly',
    priority: '0.7',
    sources: ['src/pages/ContactPage.tsx', 'src/components/Contact.tsx'],
  },
  {
    path: '/faq',
    title: 'Cleaning Questions | VVE Clean FAQ',
    description: 'Answers about VVE Clean prices, booking requests, payment, rescheduling, coverage and the end of tenancy re-clean guarantee.',
    ogTitle: 'VVE Clean Frequently Asked Questions',
    ogDescription: 'Clear answers about booking, payment, coverage and cleaning services.',
    changefreq: 'monthly',
    priority: '0.7',
    sources: ['src/pages/FaqPage.tsx', 'src/components/FAQ.tsx'],
  },
];

// The 404 page is rendered like any other route, but it is written to
// dist/404.html rather than a directory. Vercel serves that file, with a real
// 404 status, for any path that matches no static file — which is why
// vercel.json no longer rewrites unmatched paths to /index.html.
const notFoundRoute: RouteDefinition = {
  // Any path that matches no <Route> renders NotFoundPage via path="*".
  path: '/__not-found',
  title: 'Page not found | VVE Clean London',
  description:
    'That page could not be found. Browse VVE Clean services, prices and contact details, or get an instant cleaning quote for East and North London.',
  ogTitle: 'Page not found | VVE Clean',
  ogDescription: 'That page could not be found — get an instant cleaning quote instead.',
  robots: 'noindex, follow',
};


// ── Area landing pages — generated from src/data/areas.ts ───────────────────
// Indexability is computed, not hardcoded: an area is `index, follow` once it
// has real proof (a matching review, a tagged job photo/clip, or a true job
// note — areaHasRealProof, shared with AreaProofSection so both agree), and
// `noindex, follow` otherwise. Today that's Islington and Stratford, the only
// two with a real tagged review; the rest flip over automatically the moment
// real proof is added to src/data/areas.ts or a manifest, no code change
// needed. See docs/LOCATION_PAGES_ASSESSMENT.md.
for (const area of AREAS) {
  const indexable = areaHasRealProof(area);
  const covered = area.coverageConfirmed !== false;
  const postcodeLabel = area.postcodes.length > 0 ? ` (${area.postcodes.join(', ')})` : '';
  routes.push({
    path: `/cleaning-${area.slug}`,
    title: covered ? `Cleaning in ${area.name}${postcodeLabel} | VVE Clean London` : `Check Cleaning Coverage in ${area.name} | VVE Clean`,
    description: covered ? `End of tenancy, carpet and sofa cleaning for ${area.name}. Check postcode coverage, compare service prices and request a preferred cleaning time.` : `Ask VVE Clean to check cleaning availability for ${area.name}. Send the full postcode before making a booking request.`,
    ogTitle: covered ? `Cleaning in ${area.name} | VVE Clean` : `Check Cleaning Coverage in ${area.name} | VVE Clean`,
    ogDescription: covered ? `End of tenancy, carpet and sofa cleaning for ${area.name}. Check your postcode, compare prices and agree the work before booking.` : `Send your full ${area.name} postcode so VVE Clean can check service availability before you book.`,
    robots: indexable ? 'index, follow' : 'noindex, follow',
    changefreq: 'monthly',
    priority: '0.6',
    sources: ['src/pages/AreaPage.tsx', 'src/data/areas.ts'],
  });
}

// ── Blog — generated from src/data/blog ─────────────────────────────────────
routes.push({
  path: '/blog',
  title: 'Blog | Cleaning & Moving Guides | VVE Clean London',
  description: 'Practical guides on cleaning, tenancy deposits and moving home in London, from VVE Clean.',
  ogTitle: 'VVE Clean Blog',
  ogDescription: 'Practical guides on cleaning, tenancy deposits and moving home in London.',
  changefreq: 'weekly',
  priority: '0.6',
  sources: ['src/pages/BlogIndexPage.tsx', 'src/data/blog/index.ts'],
});
for (const post of BLOG_POSTS) {
  routes.push({
    path: `/blog/${post.slug}`,
    // A post supplying `seoTitle` is already close to the ~65-character
    // budget, so it takes the shorter brand suffix.
    title: post.seoTitle
      ? `${post.seoTitle} | VVE Clean`
      : `${post.title} | VVE Clean Blog`,
    description: post.excerpt,
    ogTitle: post.title,
    ogDescription: post.excerpt,
    // Editorial review is required before legal guidance enters search.
    robots: 'noindex, follow',
    changefreq: 'monthly',
    priority: '0.5',
    sources: ['src/pages/BlogPostPage.tsx', `src/data/blog/posts/${post.slug}.ts`],
  });
}

function completeMetadata(route: RouteDefinition, canonical: string | null): RouteMetadata {
  return {
    ...route,
    ogTitle: route.ogTitle || route.title,
    ogDescription: route.ogDescription || route.description,
    robots: route.robots || 'index, follow',
    canonical,
    referrer: route.path === '/manage-booking' ? 'no-referrer' : 'strict-origin-when-cross-origin',
  };
}

export const ROUTE_METADATA = routes.map((route) =>
  completeMetadata(route, `${METADATA_BASE_URL}${route.path}`),
);
export const NOT_FOUND_METADATA = completeMetadata(notFoundRoute, null);

export function metadataForPath(pathname: string): RouteMetadata {
  let path = pathname.split(/[?#]/, 1)[0];
  try { path = decodeURIComponent(path); } catch { return NOT_FOUND_METADATA; }
  path = path.replace(/\/+$/, '').toLowerCase() || '/';
  return ROUTE_METADATA.find((route) => route.path === path) || NOT_FOUND_METADATA;
}

/** Replace all route-owned head values, including stale tags from the previous page. */
export function applyRouteMetadata(pathname: string, doc: Document = document) {
  const route = metadataForPath(pathname);
  doc.title = route.title;
  const meta = (attribute: 'name' | 'property', key: string, value: string) => {
    const existing = [...doc.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)];
    const element = existing.shift() || doc.createElement('meta');
    existing.forEach((duplicate) => duplicate.remove());
    element.setAttribute(attribute, key);
    element.content = value;
    if (!element.isConnected) doc.head.appendChild(element);
  };
  meta('name', 'description', route.description);
  meta('name', 'robots', route.robots);
  meta('name', 'referrer', route.referrer);
  meta('property', 'og:title', route.ogTitle);
  meta('property', 'og:description', route.ogDescription);
  meta('property', 'og:url', route.canonical || `${METADATA_BASE_URL}/404`);
  meta('name', 'twitter:title', route.ogTitle);
  meta('name', 'twitter:description', route.ogDescription);
  const canonicals = [...doc.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')];
  const canonical = canonicals.shift() || doc.createElement('link');
  canonicals.forEach((duplicate) => duplicate.remove());
  if (route.canonical) {
    canonical.rel = 'canonical';
    canonical.href = route.canonical;
    if (!canonical.isConnected) doc.head.appendChild(canonical);
  } else canonical.remove();
  return route;
}
