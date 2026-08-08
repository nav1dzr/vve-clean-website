import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
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
    a: 'Carpets are usually dry within 2–4 hours. We use powerful extraction equipment that removes most of the moisture at the end of the clean, so drying is much faster than older steam methods.',
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
    a: `Yes. Standard rugs start at ${pd(CARPET_ITEM_PRICES_P.rug)}. Larger, wool or specialist rugs may need a photo review first so the construction and a suitable cleaning method can be checked and the price confirmed before booking.`,
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
  return (
    <figure className="relative isolate overflow-hidden rounded-[2rem] border border-white/15 bg-navy-950 shadow-2xl shadow-black/35 aspect-[16/10] sm:aspect-[3/2] lg:aspect-[4/3]">
      <img
        src="/images/carpet-cleaning-hero.webp"
        alt="Professional hot-water extraction cleaning on a deep blue carpet"
        width={1672}
        height={941}
        loading="eager"
        decoding="async"
        className="h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/5 to-transparent" aria-hidden="true" />
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" aria-hidden="true" />

      <figcaption className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-navy-950/75 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-200 backdrop-blur-md">
          <Droplets size={15} aria-hidden="true" />
          Professional extraction
        </div>
        <p className="font-display text-2xl font-bold text-white sm:text-3xl">Deep clean, visible results</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-silver-200 sm:text-base">
          Hot-water extraction lifts embedded dirt, stains and odours from deep in the carpet pile.
        </p>
      </figcaption>
    </figure>
  );
}

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Carpet Cleaning London',

  eyebrow: 'Professional Carpet Cleaning',
  h1: 'Carpet Cleaning London',
  h1Highlight: ' — deeper than the surface.',
  heroHighlightClassName: 'text-gradient-carpet',
  heroSubtitle: 'Deep steam cleaning and stain removal',
  heroAside: <CarpetHeroPanel />,
  heroAsideOnMobile: true,
  // This slot now carries a different, existing benefit (see the "Fixed prices,
  // no surprises" benefit card and the fixed price table further down).
  heroBadges: [
    'Hot-water extraction',
    'Dry in 2–4 hours',
    'Fixed prices, no surprises',
  ],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: '£5m public liability insurance · fibre checked before treatment',
  primaryHref: '/carpet-cleaning-london#quote',
  primaryLabel: 'Build my carpet quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
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
      title: 'Dry in 2–4 hours',
      body: 'Our high-powered extraction equipment removes most of the water immediately. Your carpet is walkable far sooner than with cheaper, low-powered machines.',
    },
    {
      icon: <Tag size={28} />,
      title: 'Fixed prices, no surprises',
      body: 'Every price is listed clearly. The only additions are extras you choose — extra rooms, stairs or the rug bundle add-on.',
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
    '£15 off if we arrive more than an hour late',
    'Free reschedule until 12pm the day before',
  ],

  pricingH2: 'Fixed carpet cleaning prices',
  pricingIntro:
    `Every room price below is fixed — the price you book is the price you pay. £${CARPET_MIN_BOOKING_P / 100} minimum booking applies.`,
  pricingRows: [
    { label: 'Bedroom', price: pd(CARPET_ITEM_PRICES_P.bedroom) },
    { label: 'Living / dining room', price: pd(CARPET_ITEM_PRICES_P.living_room) },
    { label: 'Large or through lounge', price: pd(CARPET_ITEM_PRICES_P.large_lounge) },
    { label: 'Hallway', price: pd(CARPET_ITEM_PRICES_P.hallway) },
    { label: 'Landing', price: pd(CARPET_ITEM_PRICES_P.landing) },
    { label: 'Stairs — first flight', price: pd(STAIRS_FIRST_P) },
    { label: 'Stairs — each additional flight', price: pd(STAIRS_EXTRA_P) },
    { label: 'Rug (standard)', price: pd(CARPET_ITEM_PRICES_P.rug) },
  ],
  pricingNote:
    'Large, wool or specialist rugs need a photo quote first. Book multiple carpet or upholstery items together and save automatically — see our discount tiers on the pricing page. What a clean can lift depends on the stain, the fibre, how long it has been there and any product already used on it, so complete removal cannot be guaranteed — we tell you the likely outcome before we start, not after.',
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
    'intro', 'why', 'pricing', 'faq', 'related',
  ],

  faqs: FAQS,

  relatedLinks: [
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Carpet Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Request booking' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody:
    'Send your booking request online. The £30 deposit is deducted from the final total, and availability is confirmed separately.',
  ctaPrimary: { href: '/booking', label: 'Request booking online' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function CarpetCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
