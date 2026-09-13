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
    a: 'We check the fabric, care label and dye stability before choosing a cleaning method. Hot-water extraction is used only where the upholstery is suitable. If testing reveals a risk, we explain it before proceeding.',
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
    a: 'The result depends on the fabric, the stain and any treatment already used. Older marks or permanent colour changes may remain. We assess the likely result before cleaning and never guarantee complete stain removal.',
  },
  {
    q: 'Which upholstery items can I request?',
    a: 'The calculator lists fabric armchairs, two-seater and three-seater sofas, corner sofas and single, double and king mattresses. Tell us about unusual sizes, loose cushions or dining chairs so we can confirm the surfaces and price before booking. The visit minimum applies to the combined selection.',
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
        { '@type': 'Offer', name: 'Mattress (double)', price: p(CARPET_ITEM_PRICES_P.mattress_double), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Mattress (king)', price: p(CARPET_ITEM_PRICES_P.mattress_king), priceCurrency: 'GBP' },
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

  eyebrow: '',
  h1: 'Sofa cleaning in London',
  h1Highlight: '',
  heroHighlightClassName: 'text-gradient-sofa',
  heroSubtitle: 'For fabric sofas, armchairs and mattresses across East & North London.',
  heroPriceChip: `2-seater sofa ${pd(CARPET_ITEM_PRICES_P.sofa_2)} · ${pd(CARPET_MIN_BOOKING_P)} minimum booking`,
  heroTaxNoteCompact: true,
  heroAside: <SofaHeroPanel />,
  heroAsideOnMobile: true,
  heroBadges: [],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  primaryHref: '/sofa-cleaning-london#quote',
  primaryLabel: 'Get a sofa quote',
  secondaryHref: WA,
  secondaryLabel: 'Send a photo on WhatsApp',
  secondaryIsWa: true,

  afterHeroSection: <QuoteCalculator mode="upholstery" />,

  introH2: 'We check the fabric before cleaning',
  introText:
    'We inspect the upholstery, check the care label and test an inconspicuous area before choosing a cleaning method. Hot-water extraction is used where the fabric is suitable, followed by controlled extraction of loosened soil and moisture. Drying time and stain response vary by fabric and condition.',

  benefitsH2: 'What to expect from upholstery cleaning',
  benefits: [
    {
      icon: <PawPrint size={28} />,
      title: 'Pet hair and odour assessment',
      body: 'Loose pet hair is removed before treatment. We assess odour sources and explain what the chosen process can reasonably improve.',
    },
    {
      icon: <Shield size={28} />,
      title: 'A method suited to the fabric',
      body: 'The care label, colour stability and material guide the method. Delicate or unsuitable fabrics are not treated with hot-water extraction.',
    },
    {
      icon: <Palette size={28} />,
      title: 'Colour test before cleaning',
      body: 'We test a small area for colour movement and discuss any risk before cleaning the rest of the upholstery.',
    },
    {
      icon: <RefreshCw size={28} />,
      title: 'Drying and aftercare',
      body: 'We explain how to ventilate the room and when the upholstery should be ready to use. Fabric, temperature and airflow affect drying.',
    },
  ],

  whyH2: 'What every sofa clean includes',
  whyPoints: [
    'Pre-inspection and fabric/dye-stability test before we start',
    'Pre-treatment spray on stains and heavily soiled areas',
    'Hot-water extraction with an upholstery attachment where the fabric is suitable',
    'Deodourising treatment included as standard',
    'All equipment and cleaning products supplied',
    'Post-clean inspection of the upholstery and cushions',
  ],

  pricingH2: 'Fixed sofa cleaning prices',
  pricingIntro:
    `Standard item prices are shown below. We agree suitability, scope and the final total before confirming your booking. £${CARPET_MIN_BOOKING_P / 100} minimum booking applies.`,
  pricingRows: [
    { label: 'Armchair', price: pd(CARPET_ITEM_PRICES_P.armchair) },
    { label: '2-seater sofa', price: pd(CARPET_ITEM_PRICES_P.sofa_2) },
    { label: '3-seater sofa', price: pd(CARPET_ITEM_PRICES_P.sofa_3) },
    { label: 'Corner / L-shaped sofa', price: pd(CARPET_ITEM_PRICES_P.sofa_corner) },
    { label: 'Mattress (single)', price: pd(CARPET_ITEM_PRICES_P.mattress_single) },
    { label: 'Mattress (double)', price: pd(CARPET_ITEM_PRICES_P.mattress_double) },
    { label: 'Mattress (king)', price: pd(CARPET_ITEM_PRICES_P.mattress_king) },
  ],
  pricingNote:
    'Carpet and upholstery items share the same visit minimum. The calculator applies the current bundle discount to eligible combined selections; see the pricing page for the item bands.',
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
    { href: '/how-we-clean-sofas-upholstery', label: 'How we clean upholstery' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/sofa-cleaning-london#quote', label: 'Get a sofa quote' },
  ],

  // Conversion order: quote (afterHeroSection, always directly under the hero)
  // → hard proof → reviews → benefits → process → supporting gallery → the
  // longer-form explanation, pricing and FAQs for anyone still reading.
  // Media used to sit below pricing, five screens down, which buried it.
  sectionOrder: [
    'proof', 'reviews', 'benefits', 'process', 'media',
    'why', 'pricing', 'faq', 'related',
  ],

  ctaH2: 'Ready to book your sofa clean?',
  ctaBody:
    'Request your preferred date free. We agree the scope, total and time with you, then send a £30 deposit link. Payment confirms your booking and counts towards the total.',
  ctaPrimary: { href: '/sofa-cleaning-london#quote', label: 'Get a sofa quote' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function SofaCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
