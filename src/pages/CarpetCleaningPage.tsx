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

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Carpet Cleaning London', item: 'https://vveclean.co.uk/carpet-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Carpet Cleaning London',
      description:
        'Professional hot-water extraction carpet cleaning in London. We remove stains, allergens and odours from bedrooms, living rooms, stairs and hallways across East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/carpet-cleaning-london',
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
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How long does carpet cleaning take?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A bedroom typically takes 20–30 minutes. A full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long before the carpet is dry?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Carpets are usually dry within 2–4 hours. We use powerful extraction equipment that removes most of the moisture at the end of the clean, so drying is much faster than older steam methods.',
          },
        },
        {
          '@type': 'Question',
          name: 'Will you remove all stains?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We remove the vast majority of stains — coffee, wine, pet accidents, mud, and general soiling respond very well to hot-water extraction. Old, set-in stains or those from bleach, dye, or permanent inks may leave a residual trace. We will always tell you the likely outcome before we start.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need to move furniture before you arrive?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We ask that you move small items, toys and breakables off the carpet before we arrive. For large furniture like sofas and beds, we use furniture slides or clean around them where it makes sense. Let us know what you need when booking.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do you clean rugs?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Standard rugs start at £40. Larger or wool rugs may need a photo quote first to check the pile type and confirm they are safe for hot-water extraction. WhatsApp us a photo for a price in minutes.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Carpet Cleaning London',

  eyebrow: 'Professional Carpet Cleaning',
  h1: 'Carpet Cleaning London',
  h1Highlight: '',
  heroSubtitle: 'Deep steam cleaning and stain removal',
  heroBadges: [
    'Hot-water extraction',
    'Dry in 2–4 hours',
    'DBS-checked technicians',
  ],
  // Single hero image for every breakpoint. A separate desktop crop was
  // referenced here previously but the file was never added, which left the
  // desktop hero with no background at all.
  heroBgImage: '/images/carpet-hero.jpg',
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: 'Fully Insured · DBS-checked technicians',
  primaryHref: '/carpet-cleaning-london#quote',
  primaryLabel: 'Build my carpet quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  afterHeroSection: <QuoteCalculator mode="carpet" />,

  introH2: 'Deep carpet cleaning, not just surface freshening',
  introText:
    'We use professional hot-water extraction — the same method recommended by most carpet manufacturers. Hot water and cleaning solution are injected deep into the carpet pile, breaking up stains and bacteria, then extracted along with the dirt. The result is a carpet that looks cleaner, smells fresher and dries in hours, not days. We serve homes and rental properties across East London (E1–E17) and North London (N1–N19).',

  benefitsH2: 'What makes our carpet cleaning different',
  benefits: [
    {
      icon: <Droplets size={28} />,
      title: 'Deep extraction, not surface scrubbing',
      body: 'Hot water penetrates deep into carpet fibres, loosening embedded grit, bacteria and allergens that surface cleaning leaves behind.',
    },
    {
      icon: <Leaf size={28} />,
      title: 'Removes allergens & pet odours',
      body: 'Dust mites, pet dander and pollen are significantly reduced. Embedded pet and smoke odours are neutralised at source, not masked.',
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

  // Real proof: the three approved before/after pairs, each with its own clip,
  // followed by the one landscape clip on a wide stage of its own.
  afterPricingSection: (
    <>
      <CarpetResultsSection />
      <CarpetProcessSection />
    </>
  ),

  // Same conversion journey as the End of Tenancy page: hero → carpet quote →
  // real proof media → reviews → benefits → about → why choose us → pricing →
  // FAQ → related → final CTA. The generic homepage-style Gallery block is
  // deliberately omitted, exactly as on EOT: it repeats proof already shown
  // above and mixes in unrelated services.
  sectionOrder: ['media', 'reviews', 'benefits', 'intro', 'why', 'pricing', 'faq', 'related'],

  faqs: [
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
      a: 'We remove the vast majority of stains — coffee, wine, pet accidents, mud and general soiling respond very well to hot-water extraction. Old, set-in stains or those from bleach, dye or permanent ink may leave a residual trace. We will always tell you the likely outcome before we start.',
    },
    {
      q: 'Do I need to move furniture before you arrive?',
      a: 'We ask that you move small items, toys and breakables off the carpet before we arrive. For large furniture like sofas and beds, we use furniture slides or clean around them where it makes sense.',
    },
    {
      q: 'Do you clean rugs?',
      a: 'Yes. Standard rugs start at £40. Larger or wool rugs may need a quick photo quote to confirm they are safe for hot-water extraction. WhatsApp us a photo for a price within the hour.',
    },
  ],

  relatedLinks: [
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Carpet Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Book Online' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody:
    'Book online in 2 minutes and pay a £30 deposit to reserve your requested appointment. It comes off the final balance, and we confirm availability within one business hour.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function CarpetCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
