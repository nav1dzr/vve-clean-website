import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import AreaProofSection from '../components/areas/AreaProofSection';
import type { AreaInfo } from '../data/areas';
import { COVERAGE_SUMMARY } from '../data/pricing';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20quote.';

function buildAreaSchema(area: AreaInfo): string {
  const postcodeLabel = area.postcodes.length > 0 ? area.postcodes.join(', ') : COVERAGE_SUMMARY;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
          { '@type': 'ListItem', position: 2, name: `Cleaning in ${area.name}`, item: `https://vveclean.co.uk/cleaning-${area.slug}` },
        ],
      },
      {
        '@type': 'Service',
        name: `Cleaning Services in ${area.name}, London`,
        description: `End of tenancy, carpet and sofa & upholstery cleaning for ${area.name} and the surrounding area. Fixed prices, the same as everywhere else we cover — no travel surcharge.`,
        provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
        areaServed: postcodeLabel,
        url: `https://vveclean.co.uk/cleaning-${area.slug}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Do you charge more to clean in ${area.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `No. Our published prices are fixed across every area we cover — ${area.name} pays the same rate as anywhere else in East or North London. The only extras that can apply to any booking, anywhere, are the same disclosed ones every customer sees: a Congestion Charge zone pass-through and a parking estimate, added only when they genuinely apply.`,
            },
          },
          {
            '@type': 'Question',
            name: `What areas near ${area.name} do you also cover?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `We also cover ${area.neighbourAreas.join(', ')}, along with the rest of our ${COVERAGE_SUMMARY} coverage area.`,
            },
          },
        ],
      },
    ],
  });
}

function buildAreaLandingData(area: AreaInfo): ServiceLandingData {
  const postcodeLabel = area.postcodes.length > 0 ? ` (${area.postcodes.join(', ')})` : '';

  return {
    schema: buildAreaSchema(area),
    breadcrumb: `Cleaning in ${area.name}`,

    eyebrow: 'East & North London Cleaning',
    h1: `Cleaning in ${area.name}`,
    h1Highlight: ' — end of tenancy, carpet & sofa.',
    heroBadges: ['Fixed prices, no travel surcharge', 'Fully insured', 'DBS-checked technicians'],
    heroGoogleBadge: true,
    heroTrustLine: 'Fully insured · DBS-checked technicians',
    primaryHref: '/booking',
    primaryLabel: 'Book online',
    secondaryHref: WA,
    secondaryLabel: 'WhatsApp for a quote',
    secondaryIsWa: true,

    introH2: `Cleaning cover for ${area.name}${postcodeLabel}`,
    introText: `We cover ${area.name} as part of our ${COVERAGE_SUMMARY} service area, alongside neighbouring areas including ${area.neighbourAreas.join(', ')}. Whichever service you need — end of tenancy, carpet, or sofa & upholstery cleaning — the price list and process are exactly the same as everywhere else we work.`,

    // Required by ServiceLandingData but unused: 'benefits' is deliberately
    // omitted from sectionOrder below (see docs/LOCATION_PAGES_ASSESSMENT.md —
    // repeating the generic sitewide benefits here would be redundant, not
    // area-specific).
    benefitsH2: '',
    benefits: [],

    whyH2: `Why book VVE Clean in ${area.name}`,
    whyPoints: [
      'The same fixed prices as every other area we cover — no travel or postcode surcharge',
      'Fully insured, DBS-checked technicians',
      '£15 off if we arrive more than an hour late',
      'Free reschedule until 12pm the day before',
    ],

    pricingH2: 'Fixed prices, wherever you are in our coverage area',
    pricingIntro: `Our published prices don't change by postcode. ${area.name} pays the same rate as any other area we cover.`,
    pricingNote: `See the full, itemised price list for every service on our pricing page. The only extras that can apply to any booking are the same disclosed ones every customer sees — a Congestion Charge zone pass-through and a parking estimate — added only when they genuinely apply, never because of where you live.`,
    pricingCta: { href: '/pricing', label: 'See all prices' },

    proofSection: <AreaProofSection area={area} />,

    sectionOrder: ['intro', 'proof', 'why', 'pricing', 'faq', 'related'],

    faqs: [
      {
        q: `Do you charge more to clean in ${area.name}?`,
        a: `No. Our published prices are fixed across every area we cover — ${area.name} pays the same rate as anywhere else in East or North London. The only extras that can apply to any booking, anywhere, are the same disclosed ones every customer sees: a Congestion Charge zone pass-through and a parking estimate, added only when they genuinely apply.`,
      },
      {
        q: `What areas near ${area.name} do you also cover?`,
        a: `We also cover ${area.neighbourAreas.join(', ')}, along with the rest of our ${COVERAGE_SUMMARY} coverage area.`,
      },
    ],

    relatedLinks: [
      { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
      { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
      { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
      { href: '/pricing', label: 'All Prices' },
      { href: '/booking', label: 'Book Online' },
    ],

    ctaH2: `Ready to book in ${area.name}?`,
    ctaBody: 'Book online in 2 minutes and pay a £30 deposit to reserve your requested appointment. It comes off the final balance, and we confirm availability within one business hour.',
    ctaPrimary: { href: '/booking', label: 'Book online now' },
    ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
  };
}

export default function AreaPage({ area }: { area: AreaInfo }) {
  return <ServiceLandingLayout data={buildAreaLandingData(area)} />;
}
