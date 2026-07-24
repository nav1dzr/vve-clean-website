import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');

const BASE_URL = 'https://vveclean.co.uk';
const OG_IMAGE = `${BASE_URL}/android-chrome-512x512.png`;

const routes = [
  {
    path: '/',
    title: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    description:
      'Professional carpet, sofa, upholstery, deep and end of tenancy cleaning across London. Fixed quotes, reliable service and fast booking. Get a free quote today.',
    ogTitle: 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
    ogDescription:
      'Professional carpet, sofa, upholstery, deep and end of tenancy cleaning across London. Fixed quotes, reliable service and fast booking.',
  },
  {
    path: '/pricing',
    title: 'Cleaning Prices East & North London | End of Tenancy, Carpet & Upholstery | VVE Clean',
    description:
      'Fixed cleaning prices for East & North London. End of tenancy from £159, carpet cleaning from £90, upholstery cleaning from £40, move-in deep clean from £139, after builders from £199. No hidden fees — the price you see is the price you pay.',
    ogTitle: 'Cleaning Prices London | VVE Clean',
    ogDescription:
      'Fixed cleaning prices for East & North London. End of tenancy from £159, carpet cleaning from £90. No hidden fees.',
  },
  {
    path: '/booking',
    title: 'Book Your Clean — VVE Clean London',
    description:
      'Book a professional cleaning service online with VVE Clean. Choose your service, fill in your details and pay a £30 deposit to secure your slot.',
    ogTitle: 'Book a Clean Online | VVE Clean London',
    ogDescription:
      'Book a professional cleaning service online with VVE Clean. Pay a £30 deposit to secure your slot.',
  },
  {
    path: '/commercial',
    title: 'Commercial & Communal Cleaning East London | Offices, Shops & Blocks | VVE Clean',
    description:
      'Contract cleaning for offices, shops, cafés and communal areas for landlords and managing agents across East & North London (E1–E17, N1–N16). Free site visit within 48 hours, fixed written quote the same day, monthly invoicing.',
    ogTitle: 'Commercial Cleaning London | VVE Clean',
    ogDescription:
      'Contract cleaning for offices, shops, cafés and communal areas across East & North London. Free site visit, fixed quote, monthly invoicing.',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | VVE Clean London',
    description:
      'How VVE LIMITED (trading as VVE Clean) collects, uses, and protects your personal data. Covers bookings, payments, cookies, your rights under UK GDPR, and how to contact us.',
    ogTitle: 'Privacy Policy | VVE Clean',
    ogDescription: 'How VVE Clean collects, uses, and protects your personal data.',
  },
  {
    path: '/terms-of-service',
    title: 'Terms of Service | VVE Clean London',
    description:
      'The terms that apply when you use VVE Clean services in London. Covers bookings, deposits, cancellations, liability, complaints, and payment.',
    ogTitle: 'Terms of Service | VVE Clean',
    ogDescription: 'The terms that apply when you use VVE Clean services in London.',
  },
  {
    path: '/leaflet',
    title: 'Leaflet Offer | 20% Off Your First Clean | VVE Clean',
    description:
      'Claim your local VVE Clean leaflet offer. Get 20% off your first carpet, sofa or upholstery clean. No code needed — discount applied automatically.',
    ogTitle: 'Leaflet Offer — 20% Off | VVE Clean',
    ogDescription:
      'Get 20% off your first carpet, sofa or upholstery clean with VVE Clean. No code needed.',
  },
  // ── Service landing pages ──────────────────────────────────────────────────
  {
    path: '/carpet-cleaning-london',
    title: 'Carpet Cleaning London | Steam-Clean & Stain Removal | VVE Clean',
    description:
      'Professional carpet cleaning in London from £50 per room. Hot-water extraction removes stains, allergens and pet odours. Fast drying — typically 2–4 hours. Book online or WhatsApp for an instant quote.',
    ogTitle: 'Carpet Cleaning London | VVE Clean',
    ogDescription:
      'Professional carpet cleaning from £50 per room. Hot-water extraction removes stains, allergens and pet odours across East and North London.',
  },
  {
    path: '/sofa-cleaning-london',
    title: 'Sofa & Upholstery Cleaning London | VVE Clean',
    description:
      'Professional sofa and upholstery cleaning in London from £75. Hot-water extraction removes stains, pet hair, odours and allergens from sofas, armchairs and mattresses across East and North London.',
    ogTitle: 'Sofa & Upholstery Cleaning London | VVE Clean',
    ogDescription:
      'Professional sofa cleaning from £75. Hot-water extraction removes stains, pet hair and odours across East and North London.',
  },
  {
    path: '/commercial-carpet-cleaning-london',
    title: 'Commercial Carpet Cleaning London | Offices & Retail | VVE Clean',
    description:
      'Professional commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits, RAMS available, fast drying times. Free site visit and fixed written quote.',
    ogTitle: 'Commercial Carpet Cleaning London | VVE Clean',
    ogDescription:
      'Commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits, RAMS available, free site visit.',
  },
  {
    path: '/end-of-tenancy-cleaning-london',
    title: 'End of Tenancy Cleaning London | From £159 | VVE Clean',
    description:
      'Professional end of tenancy cleaning in London from £159. 67-point agency checklist, free oven clean included, 48-hour re-clean guarantee. Covering East and North London — E1–E17 and N1–N19.',
    ogTitle: 'End of Tenancy Cleaning London | VVE Clean',
    ogDescription:
      'End of tenancy cleaning from £159. 67-point checklist, free oven clean, 48-hour re-clean guarantee across East and North London.',
  },
  {
    path: '/after-builders-cleaning-london',
    title: 'After Builders Cleaning London | From £199 | VVE Clean',
    description:
      'Post-construction cleaning in London from £199. We remove fine dust, paint splashes, sticker residue and construction debris — leaving your space spotless and move-in ready. Quote by photo within the hour.',
    ogTitle: 'After Builders Cleaning London | VVE Clean',
    ogDescription:
      'Post-construction cleaning from £199. Fine dust, paint splashes and debris removed. Quote by photo within the hour across East and North London.',
  },
];

const { render } = await import('./dist/server/entry-server.js');
const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

for (const route of routes) {
  const html = render(route.path);
  const canonical = `${BASE_URL}${route.path === '/' ? '' : route.path}`;

  let output = template.replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>`
  );

  output = output.replace(
    /<title>[^<]*<\/title>/,
    `<title>${route.title}</title>`
  );

  output = output.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${route.description}"`
  );

  output = output.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${route.ogTitle}"`
  );

  output = output.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${route.ogDescription}"`
  );

  output = output.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${canonical}"`
  );

  // Inject canonical — replace placeholder or insert after og:url
  if (output.includes('<link rel="canonical"')) {
    output = output.replace(
      /<link rel="canonical" href="[^"]*"[^>]*>/,
      `<link rel="canonical" href="${canonical}" />`
    );
  } else {
    output = output.replace(
      '</title>',
      `</title>\n    <link rel="canonical" href="${canonical}" />`
    );
  }

  const outPath =
    route.path === '/'
      ? resolve(distDir, 'index.html')
      : resolve(distDir, route.path.slice(1), 'index.html');

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(`Pre-rendered ${route.path}`);
}
