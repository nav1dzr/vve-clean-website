import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import SofaProofSection from '../components/sofa/SofaProofSection';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20sofa%20cleaning%20quote.';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'How We Clean Sofas & Upholstery', item: 'https://vveclean.co.uk/how-we-clean-sofas-upholstery' },
      ],
    },
    {
      '@type': 'Service',
      name: 'How We Clean Sofas & Upholstery',
      description: 'How VVE Clean cleans sofas and upholstery in London — the fabric test, hot-water extraction, and what to expect.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/how-we-clean-sofas-upholstery',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do I know if my sofa is safe to clean?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Before we start, we carry out a quick fabric and dye-stability test to confirm the upholstery is suitable for hot-water extraction. Most modern fabric sofas are compatible, and we will tell you honestly if a different method would give a better result.',
          },
        },
        {
          '@type': 'Question',
          name: 'Will the colours run or fade?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We test for dye stability on every sofa before using any cleaning solution. If there is a risk of colour bleed, we let you know before starting and do not proceed without your agreement.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'How We Clean Sofas & Upholstery',

  eyebrow: 'Our Process',
  h1: 'How We Clean Sofas & Upholstery',
  h1Highlight: ' — the process, step by step.',
  heroBadges: ['Fabric-tested first', 'Hot-water extraction', 'Fully insured'],
  heroGoogleBadge: true,
  primaryHref: '/sofa-cleaning-london#quote',
  primaryLabel: 'Get a sofa quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  introH2: 'A fabric test first, then hot-water extraction',
  introText: 'Upholstery fabrics vary far more than carpets, so every job starts with a quick fabric and dye-stability check before any cleaning solution touches the sofa. Here is exactly what that involves, with real results from real jobs.',

  benefitsH2: '',
  benefits: [],
  whyH2: '',
  whyPoints: [],

  proofSection: <SofaProofSection />,
  sectionOrder: ['intro', 'proof', 'faq', 'related'],

  faqs: [
    {
      q: 'How do I know if my sofa is safe to clean?',
      a: 'Before we start, we carry out a quick fabric and dye-stability test to confirm the upholstery is suitable for hot-water extraction. Most modern fabric sofas are compatible, and we will tell you honestly if a different method would give a better result.',
    },
    {
      q: 'Will the colours run or fade?',
      a: 'We test for dye stability on every sofa before using any cleaning solution. If there is a risk of colour bleed, we let you know before starting and do not proceed without your agreement.',
    },
  ],

  relatedLinks: [
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Prices' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your sofa clean?',
  ctaBody: 'Book online in 2 minutes and pay a £30 deposit to reserve your requested appointment. It comes off the final balance, and we confirm availability within one business hour.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanSofasPage() {
  return <ServiceLandingLayout data={DATA} />;
}
