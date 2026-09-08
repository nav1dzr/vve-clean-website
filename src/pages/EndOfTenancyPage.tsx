import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import ServiceHeroPhoto from '../components/ServiceHeroPhoto';
import QuoteCalculator from '../components/QuoteCalculator';
import EotResultsSection from '../components/gallery/EotResultsSection';
import GuaranteeTerms from '../components/GuaranteeTerms';
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
    q: 'Does your clean meet letting agent standards?',
    a: 'Yes, on our Complete Agency-Ready package. We follow a 67-point checklist based on standard letting agency inventory requirements. We also provide a photographic cleaning receipt you can share with your agent. Our Tailored package covers the core clean plus whichever internal tasks you add — the guarantee applies to the tasks in your confirmed quote.',
  },
  {
    q: 'Is the oven clean really included for free?',
    a: 'Yes. Oven cleaning is included in every end of tenancy clean at no extra cost. Hob, extractor filter and grill are included too — oven, fridge/freezer and internal storage can all be included upfront on Complete, with no surprise appliance charges.',
  },
  {
    q: 'Which appliances are included in the Complete price?',
    a: 'The Complete price includes the oven, hob, grill, extractor, inside an emptied fridge and defrosted freezer, and accessible dishwasher and washing-machine compartments. Appliances must be empty and accessible; repairs and dismantling are not included. On the Tailored package these are priced individually and shown in full before you select them.',
  },
  {
    q: `What is the ${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee?`,
    a: `If you, your letting agent or landlord report a missed task from the agreed cleaning scope within ${EOT_GUARANTEE_HOURS / 24} days of completion, we arrange one free return to re-clean that task. Send photographs or the written inspection report so we can review the missed work and agree access for the return. The guarantee does not cover permanent damage, wear and tear, permanent stains, or new mess created after the team leaves. Complete gets the full agency-ready guarantee; Tailored is covered for the tasks you selected.`,
  },
  {
    q: 'What is the difference between Complete and Tailored?',
    a: 'Complete Agency-Ready Clean is our recommended, fixed-price package covering the entire property to the full checklist — including microwave, fridge/freezer, cupboards, dishwasher and washing machine. Tailored Checklist Clean starts lower and covers the core clean plus a standard oven, hob, grill and extractor clean; you add back only the other internal tasks you need at published prices.',
  },
  {
    q: 'Do you work in occupied properties?',
    a: 'Not currently. We specialise in vacant properties — the property needs to be empty to allow us to clean to the full 67-point standard.',
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
        `Inventory-grade end of tenancy cleaning across East and North London. 67-point agency checklist, free oven clean, ${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee and photographic receipt included as standard. Complete Agency-Ready and Tailored Checklist packages available.`,
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
  heroSubtitle: 'Moving out? Choose Complete for our full 67-point checklist, or Tailored for selected internal tasks. Oven cleaning is included in both.',
  heroAside: <ServiceHeroPhoto src="/end_of_tenancy/before-after/kitchen1_after.jpg" alt="Kitchen hob after cleaning" caption="Kitchen hob, after cleaning" detail="See the full before-and-after pair below. Cleaning does not repair existing scratches or wear." />,
  heroAsideOnMobile: true,
  heroPriceChip: `Complete from ${pDisplay(EOT_BASE_PRICES_P.studio)} · Tailored from ${pDisplay(EOT_TAILORED_START_PRICES_P.studio)}`,
  heroBadges: [
    'Free oven clean included',
    `${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`,
    'Photographic receipt for your agent',
  ],
  heroGoogleBadge: true,
  heroCompactMobile: true,
  heroTrustLine: '£5m public liability insurance · scope agreed with you',
  primaryHref: '/end-of-tenancy-cleaning-london#quote',
  primaryLabel: 'Build my quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp us first',
  secondaryIsWa: true,

  afterHeroSection: <QuoteCalculator mode="eot" />,

  introH2: 'The clean your agent actually checks for',
  introText:
    'End of tenancy cleans are not the same as a regular deep clean. Letting agents work from a detailed inventory checklist — and so do we. Choose our Complete Agency-Ready package for the entire property covered to the full 67-point standard, or our Tailored Checklist package to build only the internal tasks you need. Oven cleaning is included free in every booking. We cover East and North London and give you a photographic receipt to support your deposit return.',

  benefitsH2: 'Why tenants and landlords choose VVE Clean',
  benefits: [
    {
      icon: <ClipboardList size={28} />,
      title: '67-point agency checklist',
      body: 'Every item your letting agent checks at inventory — we clean it on the Complete package. No area is missed because we work from the same standard checklist agents use.',
    },
    {
      icon: <PackageCheck size={28} />,
      title: 'Free oven clean included',
      body: 'Inside oven, hob, extractor filter and grill — all included at no extra cost on Complete, with no surprise appliance charges.',
    },
    {
      icon: <RefreshCw size={28} />,
      title: `${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee`,
      body: `Report missed work from the agreed scope within ${EOT_GUARANTEE_HOURS / 24} days, with photos or an inspection report. We arrange one free return for covered areas. See the full terms below.`,
    },
    {
      icon: <Camera size={28} />,
      title: 'Photographic cleaning receipt',
      body: 'We photograph the property after cleaning so you have documented proof. Useful for any deposit dispute where the condition at checkout is questioned.',
    },
  ],

  whyH2: 'What every Complete end of tenancy clean includes',
  whyPoints: [
    'Our published 67-point Complete cleaning checklist',
    'Inside oven, hob, extractor filter and grill — free',
    'Inside all cupboards, drawers and wardrobes',
    'Bathrooms fully descaled, tiles, grouting and fixtures',
    'Internal windows cleaned streak-free',
    'Skirting boards, light switches and door frames wiped',
    `${EOT_GUARANTEE_HOURS / 24} days to report missed work from the agreed scope`,
    'Photographic cleaning receipt emailed on completion',
  ],

  pricingH2: 'Fixed end of tenancy cleaning prices',
  pricingIntro:
    `Prices are fixed by property size for normally maintained, vacant flats. Complete Agency-Ready covers our full published cleaning checklist; optional extras remain separate. Prefer to choose only what you need? Tailored Checklist starts from £${EOT_TAILORED_START_PRICES_P.studio / 100} — build it in the quote above.`,
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
    'Prices are for normally maintained, vacant properties with reasonable access. Carpet steam cleaning, upholstery, exterior windows, balconies and rubbish removal are available as paid extras. Parking and the Congestion Charge, where applicable, are passed through at actual cost — never an invented flat fee — and confirmed with you before the booking is accepted. Heavy soiling, mould, biohazard contamination or extreme conditions require a photo review and confirmed quote before work starts.',
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
    { href: '/booking', label: 'Request a time' },
  ],

  ctaH2: 'Book your end of tenancy clean today.',
  ctaBody:
    'Request your preferred date free. We agree the scope, total and time with you, then send a £30 deposit link. Payment confirms your booking and counts towards the total.',
  ctaPrimary: { href: '/booking', label: 'Request a time' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function EndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
