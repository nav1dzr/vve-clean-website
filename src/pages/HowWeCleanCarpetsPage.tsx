import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import CarpetResultsSection from '../components/carpet/CarpetResultsSection';
import CarpetProcessSection from '../components/carpet/CarpetProcessSection';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20carpet%20clean%20quote.';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'How We Clean Carpets', item: 'https://www.vveclean.co.uk/how-we-clean-carpets' },
      ],
    },
    {
      '@type': 'Service',
      name: 'How We Clean Carpets',
      description: 'How VVE Clean cleans carpets in London using hot-water extraction — the equipment, the process, and what to expect.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/how-we-clean-carpets',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What method do you use to clean carpets?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'After checking the carpet, cleaning solution is applied through the pile and extracted with loosened soil and moisture. Hot-water extraction is used only where the fibre and construction are suitable.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long does the whole process take?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A bedroom typically takes 20–30 minutes; a full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'How We Clean Carpets',

  eyebrow: 'Our Process',
  h1: 'How We Clean Carpets',
  h1Highlight: ' — the process, step by step.',
  heroBadges: ['Hot-water extraction', 'Dry in 2–4 hours', 'Fully insured'],
  heroGoogleBadge: true,
  primaryHref: '/carpet-cleaning-london#quote',
  primaryLabel: 'Get a carpet quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  introH2: 'Hot-water extraction, not surface scrubbing',
  introText: 'Every carpet clean starts with an inspection of the carpet type and stain condition, then pre-treatment on heavy soiling before hot-water extraction lifts the dirt out of the pile. Here is exactly what that involves.',

  benefitsH2: '',
  benefits: [],
  whyH2: '',
  whyPoints: [],

  proofSection: <CarpetResultsSection />,
  processSection: <CarpetProcessSection />,
  sectionOrder: ['intro', 'proof', 'process', 'faq', 'related'],

  faqs: [
    {
      q: 'What method do you use to clean carpets?',
      a: 'After checking the carpet, cleaning solution is applied through the pile and extracted with loosened soil and moisture. Hot-water extraction is used only where the fibre and construction are suitable.',
    },
    {
      q: 'How long does the whole process take?',
      a: 'A bedroom typically takes 20–30 minutes; a full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
    },
    {
      q: 'How long before the carpet is dry?',
      a: 'Carpets are usually dry within 2–4 hours. Our high-powered extraction equipment removes most of the moisture at the end of the clean, so drying is much faster than older steam methods.',
    },
  ],

  relatedLinks: [
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning Prices' },
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody: 'Send your booking request online. The £30 deposit is deducted from the final total, and availability is confirmed separately.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanCarpetsPage() {
  return <ServiceLandingLayout data={DATA} />;
}
