import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';
import ManagedServiceHeroPhoto from '../components/media/ManagedServiceHeroPhoto';
import QuoteCalculator from '../components/QuoteCalculator';
import { FAQS, SCHEMA } from '../data/carpetContent';
import CarpetResultsSection from '../components/carpet/CarpetResultsSection';
import CarpetProcessSection from '../components/carpet/CarpetProcessSection';
import { Droplets, Leaf, Clock, Tag } from 'lucide-react';
import {
  CARPET_ITEM_PRICES_P,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  CARPET_MIN_BOOKING_P,
} from '../data/pricing';

const pd = (pence: number) => `£${pence / 100}`;

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20carpet%20clean%20quote.';

function CarpetHeroPanel() {
  return <ManagedServiceHeroPhoto service="carpet" fallback={{ src: '/images/carpet-cleaning-hero.webp', alt: 'Extraction equipment working on a blue carpet', caption: 'Carpet extraction in progress' }} detail={<a href="#results" className="inline-flex min-h-11 items-center font-semibold text-royal-700 underline underline-offset-4">See before &amp; after results</a>} />;
}

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  featuredReviewService: 'Carpet Cleaning',
  breadcrumb: 'Carpet Cleaning London',

  eyebrow: 'Professional Carpet Cleaning',
  h1: 'Carpet cleaning in London',
  h1Highlight: '',
  heroHighlightClassName: 'text-gradient-carpet',
  heroSubtitle: 'Carpet cleaning across East & North London, with fibre checks and stain assessment before treatment.',
  heroPriceChip: `Carpet cleaning visits from ${pd(CARPET_MIN_BOOKING_P)}`,
  heroTaxNoteCompact: true,
  heroAside: <CarpetHeroPanel />,
  heroAsideOnMobile: true,
  heroBadges: [
    'Hot-water extraction',
    'Typical drying: 2–4 hours',
    'Clear standard room prices',
  ],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: '£5m public liability insurance · fibre checked before treatment',
  primaryHref: '/carpet-cleaning-london#quote',
  primaryLabel: 'Choose my rooms',
  secondaryHref: WA,
  secondaryLabel: 'Ask us on WhatsApp',
  secondaryIsWa: true,

  afterHeroSection: <>
    <QuoteCalculator mode="carpet" />
    <section className="border-y border-sky-100 bg-sky-50/70 px-4 py-8" aria-labelledby="carpet-care-heading">
      <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-[1fr_1.7fr] sm:items-center">
        <div>
          <h2 id="carpet-care-heading" className="font-display text-xl font-bold text-navy-950">Before your carpet clean</h2>
          <p className="mt-2 text-sm font-semibold text-royal-700">£5m public liability insurance</p>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">We check the fibre and discuss any stains that may remain before treatment. Typical drying is 2–4 hours; fibre, ventilation and room conditions affect the time. <a href="#process" className="inline-flex min-h-11 items-center font-semibold text-royal-700 underline underline-offset-4">See how we clean your carpets</a></p>
      </div>
    </section>
  </>,

  introH2: 'Cleaning suited to your carpet',
  introText:
    'We inspect the carpet and use hot-water extraction where the fibre and construction are suitable. Cleaning solution is applied through the pile and extracted with loosened soil. Drying time varies with fibre, airflow and room conditions. We serve homes and rental properties across our published East and North London postcodes.',

  benefitsH2: 'What to expect from your carpet clean',
  benefits: [
    {
      icon: <Droplets size={28} />,
      title: 'Soil and moisture extraction',
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
    'Hot-water extraction where the fibre and construction are suitable',
    'Post-clean grooming to restore carpet pile direction',
    'Furniture slides to protect floors while we work',
    'All equipment and cleaning products supplied',
  ],

  pricingH2: 'Carpet cleaning item prices',
  pricingIntro:
    `Use these rates to build your quote. The minimum cleaning charge is ${pd(CARPET_MIN_BOOKING_P)} per visit, shared across your carpet and upholstery items. Any agreed access costs are separate.`,
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
    'The calculator applies the current carpet and upholstery bundle discount automatically, subject to the minimum booking. See the pricing page for the item bands. Rugs are an add-on only and need a photo quote. Stain removal depends on the fibre, age of the mark and previous treatments.',
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
    { href: '/carpet-cleaning-london#quote', label: 'Get a carpet quote' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody:
    BOOKING_REQUEST_NOTE,
  ctaPrimary: { href: '/carpet-cleaning-london#quote', label: 'Get a carpet quote' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function CarpetCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
