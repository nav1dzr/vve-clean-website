import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import ServiceHeroPhoto from '../components/ServiceHeroPhoto';
import QuoteCalculator from '../components/QuoteCalculator';
import CarpetResultsSection from '../components/carpet/CarpetResultsSection';
import CarpetProcessSection from '../components/carpet/CarpetProcessSection';
import { Droplets, Leaf, Clock, Tag } from 'lucide-react';
import {
  CARPET_ITEM_PRICES_P,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  CARPET_MIN_BOOKING_P,
} from '../data/pricing';

const p = (pence: number) => String(pence / 100);
const pd = (pence: number) => `£${pence / 100}`;

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20carpet%20clean%20quote.';

// Single source for the visible accordion and the FAQPage schema — see the
// same note in EndOfTenancyPage.tsx.
const FAQS = [
  {
    q: 'How long does carpet cleaning take?',
    a: 'A bedroom typically takes 20–30 minutes. A full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
  },
  {
    q: 'How long before the carpet is dry?',
    a: 'Carpets typically dry in 2–4 hours. Fibre, ventilation and room conditions affect the time. We explain drying and safe use after the clean.',
  },
  {
    q: 'Will you remove all stains?',
    a: 'Some coffee, wine, pet, mud and general-soiling marks can respond to treatment, but the result depends on the fibre, stain and products already used. Bleach, dye and permanent ink can leave a lasting mark. Complete removal cannot be guaranteed.',
  },
  {
    q: 'Do I need to move furniture before you arrive?',
    a: 'We ask that you move small items, toys and breakables off the carpet before we arrive. For large furniture like sofas and beds, we use furniture slides or clean around them where it makes sense. Let us know what you need when booking.',
  },
  {
    q: 'Do you clean rugs?',
    a: 'Yes, as an add-on to a carpet, upholstery or relevant end of tenancy clean. Send a photo first so the construction, fibre, cleaning method and price can be confirmed. We do not currently offer rug-only bookings.',
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Carpet Cleaning London', item: 'https://www.vveclean.co.uk/carpet-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Carpet Cleaning London',
      description:
        'Professional hot-water extraction carpet cleaning for bedrooms, living rooms, stairs and hallways across East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/carpet-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Bedroom carpet clean', price: p(CARPET_ITEM_PRICES_P.bedroom), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Living / dining room carpet clean', price: p(CARPET_ITEM_PRICES_P.living_room), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Large or through lounge', price: p(CARPET_ITEM_PRICES_P.large_lounge), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Hallway carpet clean', price: p(CARPET_ITEM_PRICES_P.hallway), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Stairs — first flight', price: p(STAIRS_FIRST_P), priceCurrency: 'GBP' },
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

function CarpetHeroPanel() {
  return <ServiceHeroPhoto src="/images/carpet-cleaning-hero.webp" alt="Extraction equipment working on a blue carpet" caption="Carpet extraction in progress" detail="We inspect the fibre and condition before choosing a suitable treatment. Stain removal varies by carpet and mark." />;
}

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Carpet Cleaning London',

  eyebrow: 'Professional Carpet Cleaning',
  h1: 'Carpet Cleaning London',
  h1Highlight: '',
  heroHighlightClassName: 'text-gradient-carpet',
  heroSubtitle: 'Professional extraction for bedrooms, living rooms, stairs and hallways. Choose your rooms and see your estimate.',
  heroPriceChip: `From ${pd(CARPET_ITEM_PRICES_P.bedroom)} per room · ${pd(CARPET_MIN_BOOKING_P)} minimum booking`,
  heroAside: <CarpetHeroPanel />,
  heroAsideOnMobile: true,
  // This slot now carries a different, existing benefit (see the "Fixed prices,
  // no surprises" benefit card and the fixed price table further down).
  heroBadges: [
    'Hot-water extraction',
    'Typical drying: 2–4 hours',
    'Clear standard room prices',
  ],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: '£5m public liability insurance · fibre checked before treatment',
  primaryHref: '/carpet-cleaning-london#quote',
  primaryLabel: 'Build my carpet quote',
  secondaryHref: WA,
  secondaryLabel: 'Ask us on WhatsApp',
  secondaryIsWa: true,

  afterHeroSection: <QuoteCalculator mode="carpet" />,

  introH2: 'Deep carpet cleaning, not just surface freshening',
  introText:
    'We inspect the carpet and use hot-water extraction where the fibre and construction are suitable. Cleaning solution is applied through the pile and extracted with loosened soil. Drying time varies with fibre, airflow and room conditions. We serve homes and rental properties across our published East and North London postcodes.',

  benefitsH2: 'What makes our carpet cleaning different',
  benefits: [
    {
      icon: <Droplets size={28} />,
      title: 'Deep extraction, not surface scrubbing',
      body: 'The process applies cleaning solution through the pile, then extracts loosened soil and moisture with professional equipment.',
    },
    {
      icon: <Leaf size={28} />,
      title: 'Targeted stain and odour treatment',
      body: 'We assess visible marks and odour sources, then choose a treatment suitable for the carpet. Results vary and permanent damage may remain.',
    },
    {
      icon: <Clock size={28} />,
      title: 'Typical drying: 2–4 hours',
      body: 'Extraction removes loosened soil and moisture. Allow around 2–4 hours for typical drying; fibre, ventilation and room conditions can extend this.',
    },
    {
      icon: <Tag size={28} />,
      title: 'Clear standard room prices',
      body: 'Every standard price is listed clearly. Rugs are assessed separately and can be added to a qualifying carpet, upholstery or end of tenancy clean.',
    },
  ],

  whyH2: 'What every carpet clean includes',
  whyPoints: [
    'Pre-inspection of carpet type and stain condition, with an honest view on what will lift',
    'Pre-treatment spray on heavy soiling and stains',
    'Hot-water extraction with professional-grade equipment',
    'Wool, synthetic, loop-pile and patterned carpets, cleaned to suit the fibre',
    'Post-clean grooming to restore carpet pile direction',
    'Furniture slides to protect floors while we work',
    'All equipment and cleaning products supplied',
    'An agreed arrival window in your booking confirmation',
    'Request a date change through your booking link; we confirm availability with you',
  ],

  pricingH2: 'Fixed carpet cleaning prices',
  pricingIntro:
    `Standard room prices are shown below. We agree the scope and final total before confirming your booking. £${CARPET_MIN_BOOKING_P / 100} minimum booking applies.`,
  pricingRows: [
    { label: 'Bedroom', price: pd(CARPET_ITEM_PRICES_P.bedroom) },
    { label: 'Living / dining room', price: pd(CARPET_ITEM_PRICES_P.living_room) },
    { label: 'Large or through lounge', price: pd(CARPET_ITEM_PRICES_P.large_lounge) },
    { label: 'Hallway', price: pd(CARPET_ITEM_PRICES_P.hallway) },
    { label: 'Landing', price: pd(CARPET_ITEM_PRICES_P.landing) },
    { label: 'Stairs — first flight', price: pd(STAIRS_FIRST_P) },
    { label: 'Stairs — each additional flight', price: pd(STAIRS_EXTRA_P) },
    { label: 'Rug cleaning', price: 'Add-on only · photo quote' },
  ],
  pricingNote:
    'Rugs are available only as an add-on to a carpet, upholstery or relevant end of tenancy clean and need a photo quote first. Book multiple carpet or upholstery items together and save automatically — see our discount tiers on the pricing page. What a clean can lift depends on the stain, the fibre, how long it has been there and any product already used on it, so complete removal cannot be guaranteed — we tell you the likely outcome before we start, not after.',
  pricingCta: { href: '/pricing', label: 'See all prices' },

  // Real proof: the three approved before/after pairs, each with its own clip.
  afterPricingSection: <CarpetResultsSection />,

  // The one landscape clip, on a wide stage of its own. It was previously
  // bundled with the results above; separating it lets the reassurance sections
  // land between the evidence and the "here's how it works" explainer, matching
  // the Sofa page's ordering.
  processSection: <CarpetProcessSection />,

  // Same conversion journey as the End of Tenancy page: hero → carpet quote →
  // real proof media → reviews → benefits → process footage → about → why
  // choose us → pricing → FAQ → related → final CTA. The generic homepage-style
  // Gallery block is deliberately omitted, exactly as on EOT: it repeats proof
  // already shown above and mixes in unrelated services.
  sectionOrder: [
    'media', 'reviews', 'benefits', 'process',
    'why', 'pricing', 'faq', 'related',
  ],

  faqs: FAQS,

  relatedLinks: [
    { href: '/how-we-clean-carpets', label: 'How we clean carpets' },
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Carpet Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Request a time' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody:
    'Request your preferred date free. We agree the scope, total and time with you, then send a £30 deposit link. Payment confirms your booking and counts towards the total.',
  ctaPrimary: { href: '/booking', label: 'Request a time' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function CarpetCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
