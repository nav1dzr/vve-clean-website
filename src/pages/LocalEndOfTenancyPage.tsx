import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import QuoteCalculator from '../components/QuoteCalculator';
import EotResultsSection from '../components/gallery/EotResultsSection';
import LocalReviewCards from '../components/local/LocalReviewCards';
import EotProcessSteps from '../components/local/EotProcessSteps';
import NearbyAreasSection from '../components/local/NearbyAreasSection';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  EOT_BASE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_GUARANTEE_HOURS,
} from '../data/pricing';
import {
  EOT_BENEFITS,
  EOT_WHY_POINTS,
  EOT_PRICING_ROWS,
  EOT_PRICING_NOTE,
} from '../data/eotContent';
import { type LocalAreaConfig, getNearbyAreas } from '../data/localEotAreas';
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_TEL,
  CONTACT_ADDRESS_LINE1,
} from '../data/contactDetails';

const BASE_URL = 'https://www.vveclean.co.uk';
const VVE_BUSINESS_ID = `${BASE_URL}/#business`;

const p = (pence: number) => String(pence / 100);
const pDisplay = (pence: number) => `£${pence / 100}`;

// Same, single real VVE Clean business entity on every local page — not five
// invented branches. No geo coordinates, no aggregate rating: see brief.
const VVE_BUSINESS = {
  '@type': 'LocalBusiness',
  '@id': VVE_BUSINESS_ID,
  name: 'VVE Clean',
  url: BASE_URL,
  telephone: '+442080502233',
  email: CONTACT_EMAIL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: CONTACT_ADDRESS_LINE1,
    addressLocality: 'London',
    postalCode: 'W2 4QP',
    addressCountry: 'GB',
  },
};

// Three universal FAQs, identical wording on every local page — combined
// with each area's three local FAQs to make exactly six visible FAQs, all of
// which appear verbatim in the FAQPage structured data below.
function universalFaqs() {
  return [
    {
      q: 'How much does end of tenancy cleaning cost?',
      a: `Prices are fixed by property size, using the same pricing as our main London end of tenancy service — Complete Agency-Ready starts at ${pDisplay(EOT_BASE_PRICES_P.studio)} for a studio, and Tailored Checklist starts from ${pDisplay(EOT_TAILORED_START_PRICES_P.studio)}. Build your exact price for a studio, 1, 2, 3 or 4 bedroom property in the calculator above; additional bathrooms are +${pDisplay(EOT_EXTRA_BATH_P)} and additional WCs are +${pDisplay(EOT_EXTRA_WC_P)} each.`,
    },
    {
      q: 'Is oven cleaning included for free?',
      a: 'Yes — on every Complete Agency-Ready booking, inside oven, hob, extractor filter and grill are included at no extra cost. On the Tailored Checklist package these are priced individually and always shown before you select them.',
    },
    {
      q: `What is the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee?`,
      a: `If your letting agent or landlord flags any area of the clean within ${EOT_GUARANTEE_HOURS} hours of completion, we return to address it for free. Complete gets the full agency-ready guarantee; on Tailored it covers the tasks included in your confirmed quote.`,
    },
  ];
}

function buildSchema(area: LocalAreaConfig, faqs: { q: string; a: string }[]) {
  const canonical = `${BASE_URL}${area.path}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'End of Tenancy Cleaning London',
            item: `${BASE_URL}/end-of-tenancy-cleaning-london`,
          },
          { '@type': 'ListItem', position: 3, name: area.h1, item: canonical },
        ],
      },
      VVE_BUSINESS,
      {
        '@type': 'Service',
        serviceType: 'End of Tenancy Cleaning',
        name: `End of Tenancy Cleaning in ${area.areaName} (${area.postcode})`,
        description: `End of tenancy cleaning covering ${area.areaName} and the ${area.postcode} postcode, near ${area.landmarks[0]} and ${area.landmarks[1]}. Same 67-point agency checklist and ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee as our main London service.`,
        provider: { '@id': VVE_BUSINESS_ID },
        areaServed: { '@type': 'AdministrativeArea', name: `${area.areaName}, ${area.postcode}, London` },
        url: canonical,
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
        mainEntity: faqs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  });
}

export default function LocalEndOfTenancyPage({ area }: { area: LocalAreaConfig }) {
  usePageMeta(area.metaTitle, area.metaDescription, area.path);

  const nearby = getNearbyAreas(area);
  const faqs = [...universalFaqs(), ...area.localFaqs];
  const schema = buildSchema(area, faqs);
  const waText = `Hi VVE Clean, I'd like to book an end of tenancy clean in ${area.areaName}.`;
  const wa = `https://wa.me/447845451111?text=${encodeURIComponent(waText)}`;

  const data: ServiceLandingData = {
    schema,
    breadcrumb: area.h1,

    eyebrow: 'End of Tenancy Cleaning',
    h1: area.h1,
    h1Highlight: area.h1Highlight,
    heroBadges: [
      'Free oven clean included',
      `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee`,
      'Photographic receipt for your agent',
    ],
    primaryHref: `${area.path}#quote`,
    primaryLabel: 'Build my quote',
    secondaryHref: wa,
    secondaryLabel: 'WhatsApp us first',
    secondaryIsWa: true,

    afterHeroSection: <QuoteCalculator mode="eot" />,

    introH2: `Moving out near ${area.landmarks[0]} or ${area.landmarks[1]}?`,
    introText: area.openingParagraph,

    benefitsH2: 'Why tenants and landlords choose VVE Clean',
    benefits: EOT_BENEFITS,

    whyH2: 'What every Complete end of tenancy clean includes',
    whyPoints: EOT_WHY_POINTS,

    pricingH2: `End of tenancy cleaning prices in ${area.areaName}`,
    pricingIntro:
      `Same fixed London pricing as our main end of tenancy service — never a separate local price book. Complete Agency-Ready is our recommended, fully-inclusive package. Prefer to choose only what you need? Tailored Checklist starts from ${pDisplay(EOT_TAILORED_START_PRICES_P.studio)} — build it in the quote above.`,
    pricingRows: EOT_PRICING_ROWS,
    pricingNote: EOT_PRICING_NOTE,
    pricingCta: { href: `${area.path}#quote`, label: 'Build my quote' },

    afterPricingSection: <EotResultsSection />,

    proofSection: <LocalReviewCards names={area.reviewNames} />,
    processSection: <EotProcessSteps />,
    nearbySection: <NearbyAreasSection area={area} nearby={nearby} />,

    faqs,

    sectionOrder: ['intro', 'proof', 'benefits', 'process', 'why', 'pricing', 'media', 'faq', 'nearby', 'related'],

    relatedLinks: [
      { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning London' },
      { href: '/pricing', label: 'All Prices' },
      { href: '/booking', label: 'Book Online' },
    ],

    ctaH2: `Book your ${area.areaName} end of tenancy clean today.`,
    ctaBody:
      'Book online in 2 minutes. Pay a £30 booking-request deposit, deducted from your final bill — we confirm availability within one business hour, balance due after you check the work.',
    ctaPrimary: { href: '/booking', label: 'Book online now' },
    ctaSecondary: { href: CONTACT_PHONE_TEL, label: 'Call 020 8050 2233', isTel: true },
  };

  return <ServiceLandingLayout data={data} />;
}
