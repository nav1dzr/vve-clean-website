import CarpetProcessSection from '../components/carpet/CarpetProcessSection';
import { Fragment } from 'react';
import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import AreaProofSection from '../components/areas/AreaProofSection';
import AreaServiceShowcase from '../components/areas/AreaServiceShowcase';
import AreaVisitGuide from '../components/areas/AreaVisitGuide';
import type { AreaInfo } from '../data/areas';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';
import { COVERAGE_SUMMARY } from '../data/pricing';

// The visible accordion and FAQPage schema share these exact answers.
function buildAreaFaqs(area: AreaInfo): { q: string; a: string }[] {
  if (area.coverageConfirmed === false) {
    return [{
      q: `Do you currently cover ${area.name}?`,
      a: `${area.name} is outside the currently published postcode list. Contact VVE Clean with the full postcode so availability and any travel requirements can be confirmed before booking.`,
    }];
  }
  return [
    {
      q: `Do you charge more to clean in ${area.name}?`,
      a: `We use the same published service prices throughout our confirmed coverage area, including ${area.name}. The total depends on your property, the work selected and its condition. Parking and any applicable Congestion Charge are shown separately and agreed before the appointment.`,
    },
    {
      q: `Which ${area.name} postcodes do you cover?`,
      a: `Our published coverage for ${area.name} is ${area.postcodes.join(', ')}. Send your full postcode if it is not listed so we can check before you book.`,
    },
    {
      q: `What areas near ${area.name} do you also cover?`,
      a: `Nearby published areas include ${area.neighbourAreas.join(', ')}, along with the rest of our ${COVERAGE_SUMMARY} coverage area. Check the postcode list or ask VVE Clean before booking if your postcode is not shown.`,
    },
    {
      q: `Which cleaning services can I book in ${area.name}?`,
      a: 'You can request end of tenancy, move-in, carpet, sofa and upholstery, after-builders or commercial cleaning. We confirm availability for your postcode, service and preferred date.',
    },
    {
      q: `How do I get a price for a property in ${area.name}?`,
      a: 'Choose a service to see its prices and use the quote builder. For unusual staining or after-builders work, send photos and property details so we can assess the work before confirming a price.',
    },
    {
      q: `Do you need parking in ${area.name}?`,
      a: 'Our team carries equipment, so we need to park reasonably close to the property. Tell us whether free parking is available when you send your request. If it is not, we agree an estimated parking allowance with you before confirming the appointment. Parking is charged at the actual cost, and the final balance is adjusted if it costs less or more than the estimate.',
    },
    {
      q: 'Does sending a request confirm my appointment?',
      a: `A request lets us check availability; it is not a confirmed appointment. ${BOOKING_REQUEST_NOTE}`,
    },
  ];
}

function buildAreaSchema(area: AreaInfo): string {
  const covered = area.coverageConfirmed !== false;
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
      ...(covered ? [{
        '@type': 'Service',
        name: `Cleaning services in ${area.name}, London`,
        description: `End of tenancy, carpet and upholstery cleaning in ${area.name}. Scope, final price and time are agreed before VVE Clean confirms the appointment.`,
        serviceType: ['End of tenancy cleaning', 'Carpet cleaning', 'Upholstery cleaning'],
        provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
        areaServed: area.postcodes.join(', '),
        url: `https://www.vveclean.co.uk/cleaning-${area.slug}`,
      }] : []),
      {
        '@type': 'FAQPage',
        mainEntity: buildAreaFaqs(area).map((faq) => ({
          '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  });
}

function buildAreaLandingData(area: AreaInfo): ServiceLandingData {
  const covered = area.coverageConfirmed !== false;
  const whatsapp = `https://wa.me/447845451111?text=${encodeURIComponent(`Hi VVE Clean, I would like a cleaning quote in ${area.name}. My full postcode is `)}`;

  return {
    schema: buildAreaSchema(area),
    breadcrumb: `Cleaning in ${area.name}`,
    eyebrow: 'East & North London cleaning',
    h1: covered ? `Cleaning in ${area.name}` : `Check cleaning availability in ${area.name}`,
    h1Highlight: '',
    heroSubtitle: covered ? `Carpets, sofas or a full move-out clean in ${area.postcodes.join(', ')}. Choose your service to see the price and request a date.` : 'Send your full postcode and the service you need. We will check whether a visit is possible before you book.',
    heroBadges: covered ? ['Request with no payment'] : ['Check your full postcode first'],
    heroCompactMobile: true,
    heroGoogleBadge: true,
    heroTrustLine: '£5m public liability insurance',
    primaryHref: covered ? '#area-services' : whatsapp,
    primaryLabel: covered ? 'Choose my service' : 'Check my postcode',
    primaryIsWa: !covered,
    secondaryHref: covered ? whatsapp : 'tel:02080502233',
    secondaryLabel: covered ? 'Ask us on WhatsApp' : 'Call 020 8050 2233',
    secondaryIsWa: covered,
    mobileLandingAction: covered
      ? { href: '#area-services', label: 'Choose my service', helpHref: whatsapp }
      : { href: whatsapp, label: 'Check my postcode', isWa: true },

    // These shared-layout sections are omitted: the service chooser and visit
    // guide carry the useful content without repeating the hero introduction.
    introH2: '',
    introText: '',
    benefitsH2: '',
    benefits: [],
    whyH2: '',
    whyPoints: [],

    proofSection: (
      <Fragment>
        {covered && <AreaServiceShowcase area={area} />}
        {covered && <AreaProofSection area={area} />}
        <AreaVisitGuide area={area} />
      </Fragment>
    ),
    processSection: covered ? <CarpetProcessSection compact /> : undefined,
    sectionOrder: covered ? ['proof', 'process', 'faq', 'related'] : ['proof', 'faq', 'related'],
    faqs: buildAreaFaqs(area),
    relatedLinks: [
      { href: '/after-builders-cleaning-london', label: 'After builders cleaning' },
      { href: '/commercial', label: 'Commercial & communal cleaning' },
      { href: '/pricing', label: 'All services & prices' },
    ],
    ctaH2: covered ? `Arrange your clean in ${area.name}` : 'Check your postcode with VVE Clean',
    ctaBody: covered ? 'Choose a service and tell us what needs cleaning. We will agree the work, final price and time with you, then confirm your appointment. No deposit is required.' : 'Include the full postcode, service and preferred date in your message. We will check availability before you send a booking request.',
    ctaPrimary: covered ? { href: '#area-services', label: 'Choose my service' } : { href: whatsapp, label: 'Check my postcode', isWa: true },
    ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
  };
}

export default function AreaPage({ area }: { area: AreaInfo }) {
  return <ServiceLandingLayout data={buildAreaLandingData(area)} />;
}