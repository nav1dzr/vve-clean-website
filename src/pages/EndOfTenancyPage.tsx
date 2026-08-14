import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import QuoteCalculator from '../components/QuoteCalculator';
import EotResultsSection from '../components/gallery/EotResultsSection';
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

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'End of Tenancy Cleaning London', item: 'https://vveclean.co.uk/end-of-tenancy-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'End of Tenancy Cleaning London',
      description:
        `Inventory-grade end of tenancy cleaning across East and North London. 67-point agency checklist, free oven clean, ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee and photographic receipt included as standard. Complete Agency-Ready and Tailored Checklist packages available.`,
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/end-of-tenancy-cleaning-london',
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
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does your end of tenancy clean meet letting agent standards?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes — our Complete Agency-Ready package does. We follow a 67-point checklist based on standard letting agency inventory requirements: inside appliances, inside cupboards, descaling bathrooms, internal windows, skirting boards and more. We also provide a photographic cleaning receipt you can share with your agent. Our Tailored Checklist package lets you choose only the tasks you need — the agency-ready guarantee applies to whichever tasks are in your confirmed quote.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which appliances are included in the Complete price?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The Complete price includes the oven, hob, grill, extractor, inside an emptied fridge and defrosted freezer, and accessible dishwasher and washing-machine compartments. Appliances must be empty and accessible; repairs and dismantling are not included. On the Tailored package these are priced individually — shown in full before you select them.',
          },
        },
        {
          '@type': 'Question',
          name: `What is the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `If your letting agent or landlord flags any area of the clean within ${EOT_GUARANTEE_HOURS} hours of completion, we return to address it for free. We ask that you send us a copy of the agent's feedback so we can prioritise the right areas. On the Complete package this covers the full agency-ready checklist; on the Tailored package it covers the tasks included in your confirmed quote.`,
          },
        },
        {
          '@type': 'Question',
          name: 'Do you work in occupied properties?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Not currently. We specialise in vacant properties — end of tenancy, move-in deep cleans, and after-builders work. The property needs to be empty to allow us to clean to the full 67-point standard.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the difference between Complete and Tailored?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Complete Agency-Ready Clean covers the entire property to the full 67-point checklist for one fixed price, including oven, fridge/freezer, cupboards, dishwasher and washing machine — the safest option for a final inspection. Tailored Checklist Clean starts from a lower price and covers the core clean; you then add back only the internal tasks you need (fridge/freezer, cupboards, dishwasher, washing machine) at published prices. Choose Complete if you want the entire checklist covered without building it item by item.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is not included in the end of tenancy price?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Prices apply to normally maintained, vacant properties. Houses and maisonettes are priced separately from flats, not a flat surcharge — shown in the quote calculator. Additional bathrooms beyond the first are +${pDisplay(EOT_EXTRA_BATH_P)} each; additional separate WCs are +${pDisplay(EOT_EXTRA_WC_P)} each. 5+ bedroom properties need a tailored quote rather than a fixed online price. Carpet steam cleaning, upholstery, exterior windows, balconies, full wall washing, rubbish removal, parking and the Congestion Charge are available as paid extras, always shown and confirmed with you before the booking is accepted — never an automatic flat-fee estimate. Heavy soiling, mould, biohazard contamination, pet accidents or extreme conditions require a photo review and confirmed quote before work starts.`,
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'End of Tenancy Cleaning London',

  eyebrow: 'End of Tenancy Cleaning',
  h1: 'End of Tenancy Cleaning London',
  h1Highlight: '— 67-Point Agency Checklist',
  heroBadges: [
    'Free oven clean included',
    `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`,
    'Photographic receipt for your agent',
  ],
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
      title: `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`,
      body: `If your agent flags anything within ${EOT_GUARANTEE_HOURS} hours of your clean, we return to fix it for free. We ask only for a copy of the agent's written feedback.`,
    },
    {
      icon: <Camera size={28} />,
      title: 'Photographic cleaning receipt',
      body: 'We photograph the property after cleaning so you have documented proof. Useful for any deposit dispute where the condition at checkout is questioned.',
    },
  ],

  whyH2: 'What every Complete end of tenancy clean includes',
  whyPoints: [
    '67-point agency checklist — the same one your agent uses',
    'Inside oven, hob, extractor filter and grill — free',
    'Inside all cupboards, drawers and wardrobes',
    'Bathrooms fully descaled, tiles, grouting and fixtures',
    'Internal windows cleaned streak-free',
    'Skirting boards, light switches and door frames wiped',
    `${EOT_GUARANTEE_HOURS}-hour free re-clean if your agent flags anything`,
    'Photographic cleaning receipt emailed on completion',
  ],

  pricingH2: 'Fixed end of tenancy cleaning prices',
  pricingIntro:
    `Prices are fixed by property size for normally maintained, vacant flats. Complete Agency-Ready is our recommended, fully-inclusive package. Prefer to choose only what you need? Tailored Checklist starts from £${EOT_TAILORED_START_PRICES_P.studio / 100} — build it in the quote above.`,
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

  faqs: [
    {
      q: 'Does your clean meet letting agent standards?',
      a: 'Yes, on our Complete Agency-Ready package. We follow a 67-point checklist based on standard letting agency inventory requirements. We also provide a photographic cleaning receipt you can share with your agent. Our Tailored package covers the core clean plus whichever internal tasks you add — the guarantee applies to the tasks in your confirmed quote.',
    },
    {
      q: 'Is the oven clean really included for free?',
      a: 'Yes. Oven cleaning is included in every end of tenancy clean at no extra cost. Hob, extractor filter and grill are included too — oven, fridge/freezer and internal storage can all be included upfront on Complete, with no surprise appliance charges.',
    },
    {
      q: `What is the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee?`,
      a: `If your letting agent or landlord flags any area within ${EOT_GUARANTEE_HOURS} hours of completion, we return to address it for free. We ask that you send us a copy of the agent's written feedback so we can prioritise the right areas. The guarantee does not cover permanent damage, wear and tear, permanent stains, or new mess created after the team leaves. Complete gets the full agency-ready guarantee; Tailored is covered for the tasks you selected.`,
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
  ],

  afterPricingSection: <EotResultsSection />,

  // Conversion-focused reading order for this page: hero → quote (via
  // afterHeroSection, always directly under the hero) → real proof media →
  // reviews → why customers choose us → about this service → why choose us
  // (navy band) → pricing → FAQ/related/final CTA. The generic homepage-style
  // Gallery block is intentionally omitted here — it duplicates the real
  // before/after proof already shown above and even repeats a generic End of
  // Tenancy pair, adding no distinct evidence on this page.
  sectionOrder: ['media', 'reviews', 'benefits', 'intro', 'why', 'pricing', 'faq', 'related'],

  relatedLinks: [
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Book Online' },
  ],

  ctaH2: 'Book your end of tenancy clean today.',
  ctaBody:
    'Book online in 2 minutes. Pay a £30 booking request deposit, deducted from your final bill — we confirm availability within one business hour, balance due after you check the work.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function EndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
