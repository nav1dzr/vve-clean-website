import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import EotProcessSection from '../components/eot/EotProcessSection';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20an%20end%20of%20tenancy%20clean%20quote.';

const FAQS = [
  {
    q: 'Does your clean meet letting agent standards?',
    a: 'Yes, on our Complete Agency-Ready package. We follow a 67-point checklist based on standard letting agency inventory requirements and provide a photographic cleaning receipt you can share with your agent.',
  },
  {
    q: `What is the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee?`,
    a: `If your letting agent or landlord flags an area of the clean within ${EOT_GUARANTEE_HOURS} hours of completion, send us their written feedback. We will return to address the relevant cleaning points for free.`,
  },
  {
    q: 'What is included in the Complete package?',
    a: 'The Complete package covers the full property checklist, including the oven, hob, extractor, emptied fridge and defrosted freezer, accessible appliance compartments, cupboards, internal windows, bathrooms, skirting boards and living areas.',
  },
  {
    q: 'What is the difference between Complete and Tailored?',
    a: 'Complete covers the full 67-point checklist for one fixed price. Tailored starts with the core clean and lets you add the internal appliance and storage tasks you need. The quote shows every selected task and price before you send the booking request.',
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
      description: `How VVE Clean carries out an end of tenancy clean in London — the 67-point checklist, free oven clean, photographic receipt and ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee.`,
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
  h1Highlight: ' — the process, step by step.',
  heroBadges: ['67-point checklist', 'Free oven clean', `${EOT_GUARANTEE_HOURS}-hour guarantee`],
  heroGoogleBadge: true,
  primaryHref: '/end-of-tenancy-cleaning-london#quote',
  primaryLabel: 'Get an end of tenancy quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  introH2: 'The same checklist your letting agent uses',
  introText: `Letting agents work from a detailed inventory checklist, and so do we — on our Complete Agency-Ready package. Here is exactly what happens from arrival to the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee.`,

  benefitsH2: '',
  benefits: [],
  whyH2: '',
  whyPoints: [],

  processSection: <EotProcessSection />,
  sectionOrder: ['intro', 'process', 'faq', 'related'],

  faqs: FAQS,

  relatedLinks: [
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Prices' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your end of tenancy clean?',
  ctaBody: 'Send your booking request online. The £30 deposit is deducted from the final total, and availability is confirmed separately.',
  ctaPrimary: { href: '/booking', label: 'Request booking online' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanEndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
