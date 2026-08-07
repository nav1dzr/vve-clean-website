import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import EotProcessSection from '../components/eot/EotProcessSection';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20an%20end%20of%20tenancy%20clean%20quote.';

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
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does your clean meet letting agent standards?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, on our Complete Agency-Ready package. We follow a 67-point checklist based on standard letting agency inventory requirements, and provide a photographic cleaning receipt you can share with your agent.',
          },
        },
        {
          '@type': 'Question',
          name: `What is the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `If your letting agent or landlord flags any area of the clean within ${EOT_GUARANTEE_HOURS} hours of completion, we return to address it for free.`,
          },
        },
      ],
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

  faqs: [
    {
      q: 'Does your clean meet letting agent standards?',
      a: 'Yes, on our Complete Agency-Ready package. We follow a 67-point checklist based on standard letting agency inventory requirements, and provide a photographic cleaning receipt you can share with your agent.',
    },
    {
      q: `What is the ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee?`,
      a: `If your letting agent or landlord flags any area of the clean within ${EOT_GUARANTEE_HOURS} hours of completion, we return to address it for free. We ask that you send us a copy of the agent's feedback so we can prioritise the right areas.`,
    },
    {
      q: 'Do you work in occupied properties?',
      a: 'Not currently. We specialise in vacant properties — the property needs to be empty to allow us to clean to the full 67-point standard.',
    },
  ],

  relatedLinks: [
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Prices' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your end of tenancy clean?',
  ctaBody: 'Send your booking request online. The £30 deposit is deducted from the final total, and availability is confirmed separately.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanEndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
