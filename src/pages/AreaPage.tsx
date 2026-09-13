import CarpetProcessSection from '../components/carpet/CarpetProcessSection';
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
      a: `Our published coverage for ${area.name} is ${postcodeLabel}. Send your full postcode if it is not listed so we can check before you book.`,
    },
    {
      q: `What areas near ${area.name} do you also cover?`,
      a: `Nearby published areas include ${area.neighbourAreas.join(', ')}, along with the rest of our ${COVERAGE_SUMMARY} coverage area. Check the postcode list or ask VVE Clean before booking if your postcode is not shown.`,
    },
    {
      q: `Which cleaning services can I book in ${area.name}?`,
      a: `You can request end of tenancy, move-in, carpet, sofa and upholstery, after-builders or commercial cleaning. We confirm availability for your postcode, service and preferred date.`,
    },
    {
      q: `How do I get a price for a property in ${area.name}?`,
      a: 'Choose the service below to use its calculator or request a quote. For unusual staining or after-builders work, send photos and property details so we can assess the work before confirming a price.',
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
    h1: covered ? `Cleaning in ${area.name}` : `Check cleaning availability in ${area.name}`,
    h1Highlight: '',
    heroSubtitle: covered ? `End of tenancy, carpet and upholstery cleaning in ${area.postcodes.join(', ')}. Choose your service to check the price and request a date.` : 'Send your full postcode and the service you need. We will check whether a visit is possible before you book.',
    heroBadges: covered ? ['Published prices', 'Fully insured', 'Check your preferred date'] : ['Check your postcode first', 'Fully insured', 'Direct confirmation'],
    heroGoogleBadge: true,
    heroTrustLine: '£5m public liability insurance · direct contact',
    primaryHref: covered ? '#area-services' : WA,
    primaryLabel: covered ? 'Choose my service' : 'Check my postcode',
    primaryIsWa: !covered,
    secondaryHref: covered ? WA : 'tel:02080502233',
    secondaryLabel: covered ? 'WhatsApp for a quote' : 'Call 020 8050 2233',
    secondaryIsWa: covered,

    introH2: covered ? `Cleaning services in ${area.name}${postcodeLabel}` : `Before you request a clean in ${area.name}`,
    introText: covered ? `Choose the work you need below. Standard service prices are the same across our confirmed coverage area; the property, selected tasks and condition determine your quote.` : `${area.name} is not in the currently published postcode list. Please check with us before making a booking request.`,

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
    ] : [
      'A clear answer on coverage before you submit a booking request',
      '£5m public liability insurance',
      'Direct contact to discuss the property and service needed',
    ],

    pricingH2: 'Fixed prices, wherever you are in our coverage area',
    pricingIntro: covered ? `Our published service prices do not change by postcode within the confirmed coverage area.` : 'The service price can be reviewed once the full postcode and visit availability are confirmed.',
    pricingNote: `We use the same published service prices throughout our confirmed coverage area. Your total depends on the property, the work selected and its condition. Any parking or Congestion Charge is shown separately and agreed before the appointment.`,
    pricingCta: { href: '/pricing', label: 'See all prices' },

    proofSection: covered ? (
      <Fragment>
        <div id="area-services" className="scroll-mt-24" />
        <AreaServiceShowcase area={area} />
        <AreaProofSection area={area} />
      </Fragment>
    ) : <AreaProofSection area={area} />,

    processSection: <CarpetProcessSection compact />,
    sectionOrder: covered ? ['intro', 'proof', 'process', 'faq', 'related'] : ['intro', 'faq', 'related'],

    faqs: buildAreaFaqs(area),

    relatedLinks: [
      { href: '/end-of-tenancy-cleaning-london#quote', label: 'Get an end of tenancy quote' },
      { href: '/carpet-cleaning-london#quote', label: 'Get a carpet quote' },
      { href: '/sofa-cleaning-london#quote', label: 'Get a sofa quote' },
      { href: '/pricing', label: 'All Prices' },
    ],

    ctaH2: covered ? `Get a cleaning quote in ${area.name}` : `Check your postcode with VVE Clean`,
    ctaBody: covered ? 'Choose a service to see its price and included work. You can send your preferred date without paying; we check availability before confirming the booking.' : 'Include the full postcode, service and preferred date in your message.',
    ctaPrimary: covered ? { href: '#area-services', label: 'Choose my service' } : { href: WA, label: 'Check my postcode' },
    ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
  };
}

export default function AreaPage({ area }: { area: AreaInfo }) {
  return <ServiceLandingLayout data={buildAreaLandingData(area)} />;
}
