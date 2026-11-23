import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';
import QuoteCalculator from '../components/QuoteCalculator';
import { FAQS, SCHEMA } from '../data/sofaContent';
import { SofaCareGuide, SofaHeroPanel } from '../components/sofa/SofaServicePreview';
import SofaProofSection from '../components/sofa/SofaProofSection';
import SofaGallerySection from '../components/sofa/SofaGallerySection';
import { PawPrint, Shield, Palette, RefreshCw } from 'lucide-react';
import {
  CARPET_ITEM_PRICES_P,
  CARPET_MIN_BOOKING_P,
} from '../data/pricing';

const pd = (pence: number) => `£${pence / 100}`;

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20sofa%20cleaning%20quote.';

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  featuredReviewService: 'Sofa Cleaning',
  breadcrumb: 'Sofa & Upholstery Cleaning London',

  eyebrow: '',
  h1: 'Sofa cleaning in London',
  h1Highlight: '',
  heroHighlightClassName: 'text-gradient-sofa',
  heroSubtitle: 'Fabric sofas, armchairs and mattresses across East & North London. We check the fabric before treatment.',
  heroPriceChip: `Sofa and upholstery visits from ${pd(CARPET_MIN_BOOKING_P)}`,
  heroTaxNoteCompact: true,
  heroAside: <SofaHeroPanel />,
  heroAsideOnMobile: true,
  heroBadges: [],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  primaryHref: '/sofa-cleaning-london#quote',
  primaryLabel: 'Choose my furniture',
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

  pricingH2: 'Sofa and upholstery item prices',
  pricingIntro:
    `Use these rates to build your quote. The minimum cleaning charge is ${pd(CARPET_MIN_BOOKING_P)} per visit, shared across your carpet and upholstery items. We check fabric suitability and agree any access costs with you.`,
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
    BOOKING_REQUEST_NOTE,
  ctaPrimary: { href: '/sofa-cleaning-london#quote', label: 'Get a sofa quote' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function SofaCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
