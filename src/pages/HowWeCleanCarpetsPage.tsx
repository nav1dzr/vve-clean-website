import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import CarpetResultsSection from '../components/carpet/CarpetResultsSection';
import CarpetProcessSection from '../components/carpet/CarpetProcessSection';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20carpet%20clean%20quote.';

const FAQS = [
  {
    q: 'What method do you use to clean carpets?',
    a: 'We inspect the carpet first, apply a suitable cleaning solution and extract the loosened soil and moisture. We use hot-water extraction only when the carpet fibre and construction are suitable.',
  },
  {
    q: 'How long does carpet cleaning take?',
    a: 'A bedroom typically takes 20 to 30 minutes. A full three-bedroom flat with hallways and a living room usually takes two to three hours. We provide an estimated duration when the booking is confirmed.',
  },
  {
    q: 'How long before the carpet is dry?',
    a: 'Carpets are usually dry within two to four hours. Ventilation, room temperature, carpet thickness and the amount of treatment needed can affect the drying time.',
  },
  {
    q: 'Can every stain be removed?',
    a: 'No cleaner can promise that every stain will disappear. We inspect and treat stains individually, but the result depends on what caused the mark, how long it has been there and whether it has changed the carpet fibre or colour.',
  },
  {
    q: 'Do I need to move the furniture?',
    a: 'Please remove small items and anything fragile before we arrive. Tell us about larger furniture when requesting the quote so access and the cleaning scope can be agreed in advance.',
  },
  {
    q: 'Do you clean rugs as well as fitted carpets?',
    a: 'Yes, as an add-on to a carpet, upholstery or relevant end of tenancy clean. We assess the rug from a photo first and will not continue if inspection or testing suggests a risk of damage or colour movement. Rug-only bookings are not currently offered.',
  },
  {
    q: 'Do you bring the cleaning equipment and products?',
    a: 'Yes. We bring the equipment and cleaning products needed for the confirmed service. We only need the access arrangements and any parking information agreed before arrival.',
  },
];

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

  faqs: FAQS,

  relatedLinks: [
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning Prices' },
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody: 'Send your preferred date online with no payment. We check availability, scope and the final price, then contact you to confirm the appointment.',
  ctaPrimary: { href: '/booking', label: 'Request a time' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function HowWeCleanCarpetsPage() {
  return <ServiceLandingLayout data={DATA} />;
}
