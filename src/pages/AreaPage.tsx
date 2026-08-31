import { Fragment } from 'react';
import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import AreaProofSection from '../components/areas/AreaProofSection';
import AreaServiceShowcase from '../components/areas/AreaServiceShowcase';
import type { AreaInfo } from '../data/areas';
import { COVERAGE_SUMMARY } from '../data/pricing';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20quote.';

// Single source for the visible accordion and the FAQPage schema on every
// area page. These were previously two separate literals whose answers had
// drifted apart on all 14 covered areas — see docs/FINAL_COMPLETION_LOG.md.
function buildAreaFaqs(area: AreaInfo): { q: string; a: string }[] {
  const covered = area.coverageConfirmed !== false;
  if (!covered) {
    return [{
      q: `Do you currently cover ${area.name}?`,
      a: `${area.name} is outside the currently published postcode list. Contact VVE Clean with the full postcode so availability and any travel requirements can be confirmed before booking.`,
    }];
  }
  const postcodeLabel = area.postcodes.join(', ');
  return [
    {
      q: `Do you charge more to clean in ${area.name}?`,
      a: `No. We use the same published prices throughout our confirmed coverage area, including ${area.name}. Parking and the Congestion Charge are added only when they apply and are confirmed before booking.`,
    },
    {
      q: `Which ${area.name} postcodes do you cover?`,
      a: `We cover ${postcodeLabel} in ${area.name}. If your postcode is not listed, send it to us before booking and we will confirm whether we can travel to you rather than leaving you to guess.`,
    },
    {
      q: `What areas near ${area.name} do you also cover?`,
      a: `Nearby published areas include ${area.neighbourAreas.join(', ')}, along with the rest of our ${COVERAGE_SUMMARY} coverage area. Check the postcode list or ask VVE Clean before booking if your postcode is not shown.`,
    },
    {
      q: `Which cleaning services can I book in ${area.name}?`,
      a: `Every service we offer is available in ${area.name}: end of tenancy, move-in deep cleaning, carpet cleaning, sofa and upholstery cleaning, after-builders cleaning and commercial work. Prices are the same as anywhere else in our coverage area.`,
    },
    {
      q: `How do I get a price for a property in ${area.name}?`,
      a: `Use the quote calculator for a price based on the property size and the work needed — no visit required for standard jobs. You can also send photos on WhatsApp if the property has unusual staining or after-builders debris, and we will confirm the price before you book.`,
    },
    {
      q: `Do you need parking in ${area.name}?`,
      a: `Our team carries equipment, so we need to park reasonably close to the property. Tell us during booking whether free parking is available. Where it is not, an estimated parking allowance is shown before you pay. Parking is charged at the actual cost, so the final balance is adjusted if it costs less or more than the estimate.`,
    },
  ];
}

function buildAreaSchema(area: AreaInfo): string {
  const postcodeLabel = area.postcodes.length > 0 ? area.postcodes.join(', ') : 'Check postcode before booking';
  const covered = area.coverageConfirmed !== false;
  const faqItems = buildAreaFaqs(area).map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
          { '@type': 'ListItem', position: 2, name: `Cleaning in ${area.name}`, item: `https://www.vveclean.co.uk/cleaning-${area.slug}` },
        ],
      },
      {
        '@type': 'Service',
        name: `Cleaning Services in ${area.name}, London`,
        description: covered ? `End of tenancy, carpet and upholstery cleaning in ${area.name}, subject to booking availability.` : `Check cleaning service availability for ${area.name} with VVE Clean before booking.`,
        provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
        areaServed: postcodeLabel,
        url: `https://www.vveclean.co.uk/cleaning-${area.slug}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems,
      },
    ],
  });
}

function buildAreaLandingData(area: AreaInfo): ServiceLandingData {
  const covered = area.coverageConfirmed !== false;
  const postcodeLabel = area.postcodes.length > 0 ? ` (${area.postcodes.join(', ')})` : '';

  return {
    schema: buildAreaSchema(area),
    breadcrumb: `Cleaning in ${area.name}`,

    eyebrow: 'East & North London Cleaning',
    h1: `Cleaning in ${area.name}`,
    h1Highlight: ' — end of tenancy, carpet & sofa.',
    heroBadges: covered ? ['Published prices', 'Fully insured', 'Check your preferred date'] : ['Check your postcode first', 'Fully insured', 'Direct confirmation'],
    heroGoogleBadge: true,
    heroTrustLine: '£5m public liability insurance · direct contact',
    primaryHref: covered ? '/booking' : WA,
    primaryLabel: covered ? 'Request a time' : 'Check my postcode',
    primaryIsWa: !covered,
    secondaryHref: WA,
    secondaryLabel: 'WhatsApp for a quote',
    secondaryIsWa: true,

    introH2: covered ? `Cleaning cover for ${area.name}${postcodeLabel}` : `Check service availability for ${area.name}`,
    introText: covered ? `VVE Clean serves ${area.name} within its published ${COVERAGE_SUMMARY} coverage area. Choose end of tenancy, carpet or upholstery cleaning, then send your preferred date for confirmation.` : `${area.name} is not in the currently published postcode list. Send the full postcode and service you need before booking so VVE Clean can confirm whether the visit is possible.`,

    // Required by ServiceLandingData but unused: 'benefits' is deliberately
    // omitted from sectionOrder below (see docs/LOCATION_PAGES_ASSESSMENT.md —
    // repeating the generic sitewide benefits here would be redundant, not
    // area-specific).
    benefitsH2: '',
    benefits: [],

    whyH2: `Why book VVE Clean in ${area.name}`,
    whyPoints: covered ? [
      'The published service price does not change by postcode within the confirmed coverage area',
      '£5m public liability insurance',
      'Direct contact if access details or your preferred date changes',
      'Reschedule without charge until 12pm the day before a confirmed appointment',
    ] : [
      'A clear answer on coverage before you submit a booking request',
      '£5m public liability insurance',
      'Direct contact to discuss the property and service needed',
    ],

    pricingH2: 'Fixed prices, wherever you are in our coverage area',
    pricingIntro: covered ? `Our published service prices do not change by postcode within the confirmed coverage area.` : 'The service price can be reviewed once the full postcode and visit availability are confirmed.',
    pricingNote: `See the full, itemised price list for every service on our pricing page. The only extras that can apply to any booking are the same disclosed ones every customer sees — a Congestion Charge zone pass-through and a parking estimate — added only when they genuinely apply, never because of where you live.`,
    pricingCta: { href: '/pricing', label: 'See all prices' },

    proofSection: covered ? (
      <Fragment>
        <AreaServiceShowcase area={area} />
        <AreaProofSection area={area} />
      </Fragment>
    ) : <AreaProofSection area={area} />,

    sectionOrder: covered ? ['intro', 'proof', 'why', 'pricing', 'faq', 'related'] : ['intro', 'why', 'faq', 'related'],

    faqs: buildAreaFaqs(area),

    relatedLinks: [
      { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
      { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
      { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
      { href: '/pricing', label: 'All Prices' },
      { href: '/booking', label: 'Request a time' },
    ],

    ctaH2: covered ? `Ready to request a cleaning time in ${area.name}?` : `Need cleaning in ${area.name}?`,
    ctaBody: covered ? 'Send your details and preferred date online with no payment. We check availability first and contact you with the closest suitable time.' : 'Send your full postcode on WhatsApp before booking so VVE Clean can confirm whether the visit is possible.',
    ctaPrimary: covered ? { href: '/booking', label: 'Request a time' } : { href: WA, label: 'Check my postcode' },
    ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
  };
}

export default function AreaPage({ area }: { area: AreaInfo }) {
  return <ServiceLandingLayout data={buildAreaLandingData(area)} />;
}
