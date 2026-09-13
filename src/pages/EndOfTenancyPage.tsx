import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import ManagedServiceHeroPhoto from '../components/media/ManagedServiceHeroPhoto';
import QuoteCalculator from '../components/QuoteCalculator';
import EotResultsSection from '../components/gallery/EotResultsSection';
import GuaranteeTerms from '../components/GuaranteeTerms';
import { GUARANTEE_SUMMARY, GUARANTEE_LIMIT } from '../data/guarantee';
import { ClipboardList, PackageCheck, RefreshCw, Camera } from 'lucide-react';
import {
  EOT_BASE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_GUARANTEE_HOURS,
} from '../data/pricing';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20book%20an%20end%20of%20tenancy%20clean.';

const p = (pence: number) => String(pence / 100);
const pDisplay = (pence: number) => `£${pence / 100}`;

// Single source for this page's questions. The visible accordion and the
// FAQPage schema are both generated from it, so the two can never drift —
// they previously did, and the schema copy of the re-clean guarantee had lost
// the exclusions the visible answer carried. See docs/BRAND_AND_UI_GUIDE.md
// ("Show FAQ text visibly whenever FAQ structured data is present").
const FAQS = [
  {
    q: 'Can I share the cleaning details with my letting agent?',
    a: 'Yes. We list the work in your quote and provide a photographic cleaning receipt. Send any specific agent requirements before booking so we can check them against your chosen package. Complete includes the listed appliance and storage interiors; Tailored covers the tasks you select.',
  },
  {
    q: 'Is oven cleaning included?',
    a: 'Yes. The oven, hob, grill and extractor are included in both packages. Complete also includes the listed microwave, fridge/freezer, dishwasher, washing-machine and storage interiors. On Tailored, those other interiors are separate selections.',
  },
  {
    q: 'Which appliances are included in the Complete price?',
    a: 'Complete includes the oven, hob, grill, extractor, microwave interior, inside an emptied fridge and defrosted freezer, and accessible dishwasher and washing-machine compartments. Appliances must be empty and accessible; repairs and dismantling are not included. Tailored includes the oven, hob, grill and extractor, with other interiors priced individually.',
  },
  {
    q: `What is the ${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee?`,
    a: `${GUARANTEE_SUMMARY} ${GUARANTEE_LIMIT} The guarantee does not cover permanent damage, wear and tear, permanent stains, or new mess created after the team leaves.`,
  },
  {
    q: 'What is the difference between Complete and Tailored?',
    a: 'Complete is our recommended move-out clean, with the listed microwave, fridge/freezer, cupboard, dishwasher and washing-machine interiors included. Tailored starts with the core clean and a standard oven, hob, grill and extractor clean. Choose the other interiors you need and compare the total before requesting a time.',
  },
  {
    q: 'Do you work in occupied properties?',
    a: 'Not for this service. End of tenancy cleaning is for vacant properties, with belongings removed so we can reach the tasks in your quote. For carpet or upholstery cleaning in an occupied home, choose the relevant service.',
  },
  {
    q: 'What is not included in the price?',
    a: `Prices apply to normally maintained, vacant properties. Houses and maisonettes are priced separately from flats, shown in the quote calculator. Each additional bathroom beyond the first is +${pDisplay(EOT_EXTRA_BATH_P)}, and each additional separate WC is +${pDisplay(EOT_EXTRA_WC_P)}. Carpet steam cleaning, upholstery, exterior windows, balconies and rubbish removal are available as paid extras. Parking and the Congestion Charge are passed through at actual cost, confirmed with you before the booking is accepted. Heavy soiling, mould, biohazard contamination, pet accidents or extreme conditions require a photo review and confirmed quote before work starts.`,
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'End of Tenancy Cleaning London', item: 'https://www.vveclean.co.uk/end-of-tenancy-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'End of Tenancy Cleaning London',
      description:
        `End of tenancy cleaning across East and North London. Oven cleaning included in both packages, with listed appliance and storage interiors in Complete. ${EOT_GUARANTEE_HOURS / 24}-day reporting window for missed covered work and photographic cleaning receipt.`,
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/end-of-tenancy-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Studio — Complete', price: p(EOT_BASE_PRICES_P.studio), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '1 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed1), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed2), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed3), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '4 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed4), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Studio — Tailored (from)', price: p(EOT_TAILORED_START_PRICES_P.studio), priceCurrency: 'GBP' },
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
  breadcrumb: 'End of Tenancy Cleaning London',

  eyebrow: 'End of Tenancy Cleaning',
  h1: 'End of Tenancy Cleaning London',
  h1Highlight: '',
  heroSubtitle: 'Moving out? Complete covers the kitchen, bathrooms and living areas, including the oven, listed appliance interiors and empty cupboards. Choose your property to check the price.',
  heroAside: <ManagedServiceHeroPhoto service="end-of-tenancy" fallback={{ src: '/end_of_tenancy/before-after/kitchen1_after.jpg', alt: 'Kitchen hob after cleaning', caption: 'A real end of tenancy result' }} detail="See the full before-and-after pair below. Cleaning does not repair existing scratches or wear." managedDetail="Cleaning does not repair existing scratches or wear." />,
  heroAsideOnMobile: true,
  heroPriceChip: `Studio flat Complete clean from ${pDisplay(EOT_BASE_PRICES_P.studio)}`,
  heroBadges: [
    'Oven cleaning included',
    `${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`,
    'Photographic receipt for your agent',
  ],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: '£5m public liability insurance · scope agreed with you',
  primaryHref: '/end-of-tenancy-cleaning-london#quote',
  primaryLabel: 'Check my price',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp us first',
  secondaryIsWa: true,

  afterHeroSection: <QuoteCalculator mode="eot" />,

  introH2: 'Choose the work your property needs',
  introText:
    'Complete includes the listed kitchen appliance and empty storage interiors as well as bathrooms, living areas, internal windows and ordinary floor cleaning. Tailored suits properties that need selected tasks. Professional carpet extraction and upholstery cleaning are optional in both. Your quote records what is included.',

  benefitsH2: 'Why tenants and landlords choose VVE Clean',
  benefits: [
    {
      icon: <ClipboardList size={28} />,
      title: 'Listed cleaning tasks',
      body: 'Check the included work before choosing your package. Send any specific agent requirements with your request so we can compare them with the cleaning you need.',
    },
    {
      icon: <PackageCheck size={28} />,
      title: 'Oven cleaning included',
      body: 'The oven, hob, grill and extractor are included in both packages. Complete also covers the other listed appliance and storage interiors.',
    },
    {
      icon: <RefreshCw size={28} />,
      title: `${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`,
      body: `Report missed work from the agreed scope within ${EOT_GUARANTEE_HOURS / 24} days, with photos or an inspection report. We arrange one free return for covered areas. See the full terms below.`,
    },
    {
      icon: <Camera size={28} />,
      title: 'Photographic cleaning receipt',
      body: 'A photographic cleaning receipt records the finished work and can be shared with your letting agent or landlord. It does not guarantee a tenancy-deposit refund.',
    },
  ],

  whyH2: 'What every Complete end of tenancy clean includes',
  whyPoints: [
    'Kitchen and living-area tasks listed in your quote',
    'Oven, hob, grill, extractor and listed appliance interiors',
    'Inside all cupboards, drawers and wardrobes',
    'Bathroom surfaces, tiles, grouting and fixtures cleaned and descaled',
    'Accessible internal windows',
    'Skirting boards, light switches and door frames wiped',
    `${EOT_GUARANTEE_HOURS / 24} days to report missed work from the agreed scope`,
    'Photographic cleaning receipt emailed on completion',
  ],

  pricingH2: 'Fixed end of tenancy cleaning prices',
  pricingIntro:
    `These prices cover normally maintained, vacant flats with one bathroom. Complete includes the listed appliance and storage interiors. Optional services are separate. For selected tasks, studio Tailored cleaning starts from £${EOT_TAILORED_START_PRICES_P.studio / 100}. Use the calculator for your property.`,
  pricingRows: [
    { label: 'Studio — Complete',                  price: pDisplay(EOT_BASE_PRICES_P.studio) },
    { label: '1 Bedroom — Complete',                price: pDisplay(EOT_BASE_PRICES_P.bed1) },
    { label: '2 Bedrooms — Complete',               price: pDisplay(EOT_BASE_PRICES_P.bed2) },
    { label: '3 Bedrooms — Complete',               price: pDisplay(EOT_BASE_PRICES_P.bed3) },
    { label: '4 Bedrooms — Complete',               price: pDisplay(EOT_BASE_PRICES_P.bed4) },
    { label: 'Studio — Tailored (from)',            price: pDisplay(EOT_TAILORED_START_PRICES_P.studio) },
    { label: '4 Bedrooms — Tailored (from)',        price: pDisplay(EOT_TAILORED_START_PRICES_P.bed4) },
    { label: 'Each additional full bathroom',       price: `+${pDisplay(EOT_EXTRA_BATH_P)}` },
    { label: 'Each additional separate WC',         price: `+${pDisplay(EOT_EXTRA_WC_P)}` },
    { label: '5+ Bedrooms',                         price: 'Tailored quote' },
  ],
  pricingNote:
    'Carpet extraction, upholstery, exterior windows, balconies and rubbish removal are outside the standard package. Parking and the Congestion Charge, where applicable, are passed through at actual cost and confirmed before you accept the booking. Heavy soiling, mould, biohazards or extreme conditions need a photo review before a price can be confirmed.',
  pricingCta: { href: '/end-of-tenancy-cleaning-london#quote', label: 'Build my quote' },

  faqs: FAQS,

  afterPricingSection: <EotResultsSection />,
  // Full guarantee terms live here rather than on the homepage (§9). The
  // homepage keeps the promise and links to #guarantee on this page.
  proofSection: <GuaranteeTerms />,

  // Conversion-focused reading order for this page: hero → quote (via
  // afterHeroSection, always directly under the hero) → real proof media →
  // reviews → why customers choose us → about this service → why choose us
  // (navy band) → pricing → FAQ/related/final CTA. The generic homepage-style
  // Gallery block is intentionally omitted here — it duplicates the real
  // before/after proof already shown above and even repeats a generic End of
  // Tenancy pair, adding no distinct evidence on this page.
  // 'proof' carries the full re-clean guarantee terms (GuaranteeTerms). It
  // sits after pricing and before the FAQ: the guarantee answers the
  // objection the price raises, and the FAQ then handles everything else.
  sectionOrder: ['media', 'reviews', 'benefits', 'why', 'pricing', 'proof', 'faq', 'related'],

  relatedLinks: [
    { href: '/how-we-clean-end-of-tenancy', label: 'See the end of tenancy checklist and process' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/end-of-tenancy-cleaning-london#quote', label: 'Get an end of tenancy quote' },
  ],

  ctaH2: 'Check the price for your move-out clean',
  ctaBody:
    'Request your preferred date free. We agree the scope, total and time with you, then send a £30 deposit link. Payment confirms your booking and counts towards the total.',
  ctaPrimary: { href: '/end-of-tenancy-cleaning-london#quote', label: 'Get an end of tenancy quote' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function EndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
