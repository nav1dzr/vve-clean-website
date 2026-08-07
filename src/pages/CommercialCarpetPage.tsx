import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import { Moon, FileText, Zap, Calendar } from 'lucide-react';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20commercial%20carpet%20clean%20please.%20Address%3A%20';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Commercial Carpet Cleaning London', item: 'https://www.vveclean.co.uk/commercial-carpet-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Commercial Carpet Cleaning London',
      description:
        'Professional commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits, RAMS available, fast drying times — priced per area with a written quote.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/commercial-carpet-cleaning-london',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Can you clean commercial carpets outside business hours?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. We offer early-morning, evening and weekend visits to avoid disrupting your team or customers. Keyholding and alarm management can be arranged for regular clients.',
          },
        },
        {
          '@type': 'Question',
          name: 'How is commercial carpet cleaning priced?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We price from the area, access, condition and agreed scope. After reviewing the site, VVE Clean provides a written quote before work is agreed.',
          },
        },
        {
          '@type': 'Question',
          name: 'What carpet types can you clean commercially?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We clean commercial loop-pile, cut-pile, and carpet tile installations using hot-water extraction. For certain specialist or heritage carpets, we carry out a pre-inspection and may recommend a low-moisture method instead.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do you provide RAMS for commercial carpet cleaning?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Risk assessments and method statements are available on request before any commercial job starts, at no extra charge. We also carry £5m public liability insurance.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can you set up a regular carpet maintenance contract?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Many offices and landlords book us for quarterly or biannual deep cleans on a rolling contract. Regular clients get priority scheduling and consolidated monthly invoicing.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Commercial Carpet Cleaning London',

  eyebrow: 'Commercial Carpet Cleaning',
  h1: 'Commercial Carpet Cleaning London',
  h1Highlight: '— Offices, Hotels & Retail',
  heroBadges: [
    'Out-of-hours visits available',
    '£5m public liability insured',
    'RAMS & method statements on request',
  ],
  primaryHref: WA,
  primaryLabel: 'Book a free site visit',
  primaryIsWa: true,
  secondaryHref: '/commercial',
  secondaryLabel: 'All commercial services',

  introH2: 'Professional carpet cleaning that fits around your business',
  introText:
    'Commercial carpet cleaning is planned around the carpet type, traffic, access and the hours your site can accommodate. We inspect the areas, agree the scope and provide a written quote before work starts. Send the address and approximate floor area to begin.',

  benefitsH2: 'Why facilities managers choose VVE Clean',
  benefits: [
    {
      icon: <Moon size={28} />,
      title: 'Out-of-hours visits',
      body: 'Early mornings, evenings and weekends are all available. We work around your opening hours so your team or customers are never disrupted.',
    },
    {
      icon: <FileText size={28} />,
      title: 'RAMS & compliance documents',
      body: 'Risk assessments, method statements and insurance certificates provided before any job starts — ready for your health & safety file.',
    },
    {
      icon: <Zap size={28} />,
      title: 'Fast drying times',
      body: 'Commercial-grade extraction equipment removes most moisture immediately. Most office carpets are dry and walkable within 2–3 hours.',
    },
    {
      icon: <Calendar size={28} />,
      title: 'Maintenance contracts available',
      body: 'Quarterly or biannual deep-clean schedules with priority booking and consolidated monthly invoicing. One supplier, one phone number.',
    },
  ],

  whyH2: 'What every commercial carpet clean includes',
  whyPoints: [
    'Free site visit and fixed written quote — no obligation',
    'Pre-inspection of traffic patterns and stain types',
    'Pre-treatment on high-traffic zones and stains',
    'Hot-water extraction with commercial-grade equipment',
    'Insurance certificate available on request',
    'Required site documents confirmed in the written scope',
    'Visit timing agreed around site access',
    'Billing and notice terms confirmed before a contract starts',
  ],

  pricingH2: 'Commercial carpet cleaning pricing',
  pricingIntro:
    'Commercial pricing is based on area, access, carpet construction, condition and the agreed task list. A written quote is supplied before work is agreed.',
  pricingNote:
    'Send the site address, approximate floor area and preferred visit window on WhatsApp. VVE Clean will reply with the next steps for reviewing the site.',
  pricingCta: {
    href: WA,
    label: 'Request a site visit',
    isWa: true,
  },

  faqs: [
    {
      q: 'Can you clean commercial carpets outside business hours?',
      a: 'Yes. We offer early-morning, evening and weekend visits to avoid disrupting your team or customers. Keyholding and alarm management can be arranged for regular clients.',
    },
    {
      q: 'How is commercial carpet cleaning priced?',
      a: 'We price from the area, access, carpet construction, condition and agreed scope. After reviewing the site, VVE Clean provides a written quote before work is agreed.',
    },
    {
      q: 'What carpet types can you clean commercially?',
      a: 'We clean commercial loop-pile, cut-pile and carpet tile installations using hot-water extraction. For specialist or heritage carpets, we carry out a pre-inspection and may recommend a low-moisture method instead.',
    },
    {
      q: 'Do you provide RAMS?',
      a: 'Yes. Risk assessments and method statements are available on request before any commercial job starts, at no extra charge. We also carry £5m public liability insurance.',
    },
    {
      q: 'Can you set up a regular maintenance contract?',
      a: 'A maintenance schedule can be included in the quote. Visit frequency, invoicing and notice terms are agreed in writing before the contract starts.',
    },
  ],

  relatedLinks: [
    { href: '/commercial', label: 'All Commercial Services' },
    { href: '/carpet-cleaning-london', label: 'Residential Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/pricing', label: 'Pricing' },
  ],

  ctaH2: 'Request a written commercial quote.',
  ctaBody:
    'Send the address, approximate floor area and access requirements. VVE Clean will confirm the review process and provide a written quote before work starts.',
  ctaPrimary: {
    href: WA,
    label: 'WhatsApp your site address',
    isWa: true,
  },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function CommercialCarpetPage() {
  return <ServiceLandingLayout data={DATA} />;
}
