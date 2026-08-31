import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import SofaProofSection from '../components/sofa/SofaProofSection';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20sofa%20cleaning%20quote.';

const FAQS = [
  {
    q: 'How do I know if my sofa is safe to clean?',
    a: 'We inspect the fabric and carry out a dye-stability test before applying cleaning solution. If the upholstery is not suitable for hot-water extraction, we explain the risk and do not continue without your agreement.',
  },
  {
    q: 'Will the colours run or fade?',
    a: 'The pre-clean test checks for colour movement. If there is a risk of bleeding or fading, we stop and discuss it with you before any full cleaning begins.',
  },
  {
    q: 'How long does a sofa take to dry?',
    a: 'Most fabric sofas dry within three to six hours. Thick fabrics may take longer. Good ventilation and a comfortably warm room help the upholstery dry more quickly.',
  },
  {
    q: 'Can you guarantee every stain will come out?',
    a: 'No. Fresh marks often respond better than older or previously treated stains. We inspect the fabric first and explain the likely result before cleaning, but permanent colour change or fibre damage cannot be cleaned away.',
  },
  {
    q: 'Do you clean leather sofas?',
    a: 'Not currently. This service is for fabric sofas, armchairs and suitable upholstery. Leather needs a specialist cleaning and conditioning process that we do not offer.',
  },
  {
    q: 'How should I prepare the sofa?',
    a: 'Please remove personal items, loose covers and anything fragile from around the sofa. Make sure there is clear access to the upholstery and tell us about any particular stains before the appointment.',
  },
  {
    q: 'Do you bring the equipment and products?',
    a: 'Yes. We bring the equipment and cleaning products needed for the confirmed upholstery service. Please provide any access or parking information before arrival.',
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'How We Clean Sofas & Upholstery', item: 'https://www.vveclean.co.uk/how-we-clean-sofas-upholstery' },
      ],
    },
    {
      '@type': 'Service',
      name: 'How We Clean Sofas & Upholstery',
      description: 'How VVE Clean cleans sofas and upholstery in London — the fabric test, hot-water extraction, and what to expect.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/how-we-clean-sofas-upholstery',
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

  faqs: FAQS,

  relatedLinks: [
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Prices' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your sofa clean?',
  ctaBody: 'Send your preferred date online with no payment. We check availability, scope and the final price, then contact you to confirm the appointment.',
  ctaPrimary: { href: '/booking', label: 'Request a time' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanSofasPage() {
  return <ServiceLandingLayout data={DATA} />;
}
