import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';
import EotProcessSection, { EotInclusions } from '../components/eot/EotProcessSection';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { GUARANTEE_SUMMARY, GUARANTEE_LIMIT } from '../data/guarantee';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20an%20end%20of%20tenancy%20clean%20quote.';

const FAQS = [
  {
    q: 'Can I share the cleaning details with my letting agent?',
    a: 'Yes. Your quote lists the cleaning work, and a photographic cleaning receipt records the finished result. If your agent has a particular checklist, send it before booking so we can compare it with the work included.',
  },
  {
    q: `What is the ${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee?`,
    a: `${GUARANTEE_SUMMARY} ${GUARANTEE_LIMIT}`,
  },
  {
    q: 'What is included in the Complete package?',
    a: 'The Complete package covers the full property checklist, including the oven, hob, extractor, emptied fridge and defrosted freezer, accessible appliance compartments, cupboards, internal windows, bathrooms, skirting boards and living areas.',
  },
  {
    q: 'What is the difference between Complete and Tailored?',
    a: 'Complete includes the listed kitchen appliance and empty storage interiors. Tailored starts with the core clean, including the oven, hob, grill and extractor, and lets you add the other interiors you need. The quote shows your selected tasks and price before you send a booking request.',
  },
  {
    q: 'Is oven cleaning included?',
    a: 'Yes. The oven, hob, grill and extractor clean are included in both end of tenancy packages. The Complete package also includes the other listed appliance and storage interiors.',
  },
  {
    q: 'Does the property need to be empty?',
    a: 'Yes. We currently carry out end of tenancy cleaning in vacant properties so the team can reach the full checklist without furniture, belongings or occupants blocking access.',
  },
  {
    q: 'Do you include professional carpet cleaning?',
    a: 'Professional carpet cleaning is an optional extra. You can add the carpeted rooms you need to the quote, and the price is shown before you submit the booking request.',
  },
  {
    q: 'Do I need to be at the property?',
    a: 'You do not need to stay during the clean if access and key arrangements have been agreed in advance. The property must be empty and the team must be able to reach every area included in the quote.',
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'How We Clean for End of Tenancy', item: 'https://www.vveclean.co.uk/how-we-clean-end-of-tenancy' },
      ],
    },
    {
      '@type': 'Service',
      name: 'How We Clean for End of Tenancy',
      description: `Preparation, included cleaning tasks and handover for a VVE Clean end of tenancy clean, with a ${EOT_GUARANTEE_HOURS / 24}-day reporting window for missed covered work.`,
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/how-we-clean-end-of-tenancy',
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
  breadcrumb: 'How We Clean for End of Tenancy',

  eyebrow: 'Our Process',
  h1: 'How We Clean for End of Tenancy',
  h1Highlight: '',
  heroSubtitle: 'Prepare your property, check the included tasks and understand what happens after the clean.',
  heroBadges: ['Listed cleaning tasks', 'Oven cleaning included', `${EOT_GUARANTEE_HOURS / 24}-day guarantee`],
  heroGoogleBadge: true,
  primaryHref: '/end-of-tenancy-cleaning-london#quote',
  primaryLabel: 'Get an end of tenancy quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  introH2: 'Before the cleaning team arrives',
  introText: 'The property needs to be vacant. Empty cupboards and appliances, defrost the freezer and arrange access before the appointment. Send any specific landlord or agent requirements with your request so we can check them against your chosen package.',

  benefitsH2: '',
  benefits: [],
  whyH2: '',
  whyPoints: [],

  processSection: <><EotInclusions /><EotProcessSection /></>,
  sectionOrder: ['intro', 'process', 'faq', 'related'],

  faqs: FAQS,

  relatedLinks: [
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Prices' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your end of tenancy clean?',
  ctaBody: BOOKING_REQUEST_NOTE,
  ctaPrimary: { href: '/end-of-tenancy-cleaning-london#quote', label: 'Get an end of tenancy quote' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanEndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
