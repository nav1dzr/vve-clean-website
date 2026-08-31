import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import QuoteCalculator from '../components/QuoteCalculator';
import { SofaCareGuide, SofaHeroPanel } from '../components/sofa/SofaServicePreview';
import SofaProofSection from '../components/sofa/SofaProofSection';
import SofaGallerySection from '../components/sofa/SofaGallerySection';
import { PawPrint, Shield, Palette, RefreshCw } from 'lucide-react';
import {
  CARPET_ITEM_PRICES_P,
  CARPET_MIN_BOOKING_P,
} from '../data/pricing';

const p = (pence: number) => String(pence / 100);
const pd = (pence: number) => `£${pence / 100}`;

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20sofa%20cleaning%20quote.';

// Single source for the visible accordion and the FAQPage schema — see the
// same note in EndOfTenancyPage.tsx. The stain answer keeps the explicit
// "we never guarantee complete removal" wording in both places.
const FAQS = [
  {
    q: 'How do I know if my sofa is safe to clean?',
    a: 'Before we start, we carry out a quick fabric and dye-stability test to confirm the upholstery is suitable for hot-water extraction. Most modern fabric sofas are compatible. We will tell you honestly if we think a different approach would give a better result.',
  },
  {
    q: 'Will the colours run or fade?',
    a: 'We test for dye stability on every sofa before applying any cleaning solution. If there is a risk of colour bleed, we let you know before we start. We do not proceed without your agreement.',
  },
  {
    q: 'How long before the sofa dries?',
    a: 'Most fabric sofas are dry within 3–6 hours. Thicker fabrics like velvet or chenille may take a little longer. Opening windows and keeping the room warm speeds up drying.',
  },
  {
    q: 'Do you clean leather sofas?',
    a: 'Not currently. Our upholstery service is for fabric sofas and chairs. Leather requires a specialist conditioning treatment that we do not offer at this time.',
  },
  {
    q: 'Can you remove wine or food stains?',
    a: 'In most cases, yes. Fresh stains respond very well. Older, set-in stains may leave a faint residual mark — we will tell you the likely outcome during the pre-inspection, never after the clean. We never guarantee complete stain removal on old marks.',
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Sofa Cleaning London', item: 'https://www.vveclean.co.uk/sofa-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Sofa & Upholstery Cleaning London',
      description:
        'Professional sofa and upholstery cleaning in London, with a fabric check and hot-water extraction where the material is suitable.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/sofa-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Armchair', price: p(CARPET_ITEM_PRICES_P.armchair), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2-seater sofa', price: p(CARPET_ITEM_PRICES_P.sofa_2), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3-seater sofa', price: p(CARPET_ITEM_PRICES_P.sofa_3), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Corner / L-shaped sofa', price: p(CARPET_ITEM_PRICES_P.sofa_corner), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Mattress (double/king)', price: p(CARPET_ITEM_PRICES_P.mattress_double), priceCurrency: 'GBP' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Sofa & Upholstery Cleaning London',

  eyebrow: 'Professional Upholstery Cleaning',
  h1: 'Sofa & Upholstery Cleaning London',
  h1Highlight: ' — cleaned with care, not guesswork.',
  heroHighlightClassName: 'text-gradient-sofa',
  heroSubtitle: 'A fabric-first clean for sofas, armchairs, mattresses and dining chairs across East & North London.',
  heroPriceChip: `2-seater sofa ${pd(CARPET_ITEM_PRICES_P.sofa_2)} · ${pd(CARPET_MIN_BOOKING_P)} minimum booking`,
  heroAside: <SofaHeroPanel />,
  heroAsideOnMobile: true,
  heroBadges: [
    'Hot-water extraction',
    'Colour-safe on most fabrics',
    'Fabric checked before treatment',
  ],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: '£5m public liability insurance · fabric checked before treatment',
  primaryHref: '/sofa-cleaning-london#quote',
  primaryLabel: 'Build my upholstery quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  afterHeroSection: <QuoteCalculator mode="upholstery" />,

  introH2: 'Sofa cleaning that goes deeper than vacuuming',
  introText:
    'We inspect the upholstery, check the care label and test an inconspicuous area before choosing a cleaning method. Hot-water extraction is used where the fabric is suitable, followed by controlled extraction of loosened soil and moisture. Drying time and stain response vary by fabric and condition.',

  benefitsH2: 'Why customers book sofa cleaning with us',
  benefits: [
    {
      icon: <PawPrint size={28} />,
      title: 'Pet hair and odour assessment',
      body: 'Loose pet hair is removed before treatment. We assess odour sources and explain what the chosen process can reasonably improve.',
    },
    {
      icon: <Shield size={28} />,
      title: 'Fabric-first method',
      body: 'The care label, colour stability and material guide the method. Delicate or unsuitable fabrics are not treated with hot-water extraction.',
    },
    {
      icon: <Palette size={28} />,
      title: 'Colour-safe process',
      body: 'We test for dye stability before applying any product. If there is any risk, we tell you before we start — never after.',
    },
    {
      icon: <RefreshCw size={28} />,
      title: 'Extends your sofa\'s life',
      body: 'Abrasive grit embedded in upholstery wears fibres from the inside. Regular cleaning removes it and slows visible wear — protecting your investment.',
    },
  ],

  whyH2: 'What every sofa clean includes',
  whyPoints: [
    'Pre-inspection and fabric/dye-stability test before we start',
    'Pre-treatment spray on stains and heavily soiled areas',
    'Hot-water extraction with professional upholstery attachment',
    'Deodourising treatment included as standard',
    'All equipment and cleaning products supplied',
    'Post-clean inspection — we check every cushion with you',
    '£15 off if we arrive more than an hour late',
    'Free reschedule until 12pm the day before',
  ],

  pricingH2: 'Fixed sofa cleaning prices',
  pricingIntro:
    `Every price below is fixed — the price you book is the price you pay. £${CARPET_MIN_BOOKING_P / 100} minimum booking applies.`,
  pricingRows: [
    { label: 'Armchair', price: pd(CARPET_ITEM_PRICES_P.armchair) },
    { label: '2-seater sofa', price: pd(CARPET_ITEM_PRICES_P.sofa_2) },
    { label: '3-seater sofa', price: pd(CARPET_ITEM_PRICES_P.sofa_3) },
    { label: 'Corner / L-shaped sofa', price: pd(CARPET_ITEM_PRICES_P.sofa_corner) },
    { label: 'Mattress (single)', price: pd(CARPET_ITEM_PRICES_P.mattress_single) },
    { label: 'Mattress (double / king)', price: pd(CARPET_ITEM_PRICES_P.mattress_double) },
  ],
  pricingNote:
    'Combine a sofa and carpet clean on the same visit to save automatically on bundle discount tiers — see all prices for details.',
  pricingCta: { href: '/pricing', label: 'See all prices' },

  // Three media slots now that the owner's set is approved, ordered by
  // conversion value rather than by convenience:
  //   proof   — four before/after pairs + the featured extraction clip, directly
  //             under the quote, where the decision is actually made.
  //   process — the fabric-first explainer, once the visitor is interested.
  //   media   — breadth: the 11 supporting photos and the other three clips.
  proofSection: <SofaProofSection />,
  processSection: <SofaCareGuide />,
  afterPricingSection: <SofaGallerySection />,

  faqs: FAQS,

  relatedLinks: [
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Request a time' },
  ],

  // Conversion order: quote (afterHeroSection, always directly under the hero)
  // → hard proof → reviews → benefits → process → supporting gallery → the
  // longer-form explanation, pricing and FAQs for anyone still reading.
  // Media used to sit below pricing, five screens down, which buried it.
  sectionOrder: [
    'proof', 'reviews', 'benefits', 'process', 'media',
    'intro', 'why', 'pricing', 'faq', 'related',
  ],

  ctaH2: 'Ready to book your sofa clean?',
  ctaBody:
    'Send your preferred date online with no payment. We check availability first and contact you before any deposit is requested.',
  ctaPrimary: { href: '/booking', label: 'Request a time' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function SofaCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
