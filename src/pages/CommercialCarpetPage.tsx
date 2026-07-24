import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20commercial%20carpet%20clean%20please.%20Address%3A%20';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Commercial Carpet Cleaning London', item: 'https://vveclean.co.uk/commercial-carpet-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Commercial Carpet Cleaning London',
      description:
        'Professional commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits, RAMS available, fast drying times — priced per area with a written quote.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/commercial-carpet-cleaning-london',
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
            text: 'We price per area (square metres) with a minimum visit charge. We visit your site, measure the areas to clean, and provide a fixed written quote the same day — no obligation.',
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
    'A clean, well-maintained carpet makes an immediate impression on clients and staff. Our commercial carpet cleaning service uses the same hot-water extraction method used in premium hotels and corporate offices — powerful enough for heavy traffic, fast enough to minimise business disruption. We provide a free site visit, measure your areas, and give you a fixed written quote the same day. We operate across East London and North London and cover sites up to 5,000 sq ft on a single visit.',

  benefitsH2: 'Why facilities managers choose VVE Clean',
  benefits: [
    {
      icon: '🌙',
      title: 'Out-of-hours visits',
      body: 'Early mornings, evenings and weekends are all available. We work around your opening hours so your team or customers are never disrupted.',
    },
    {
      icon: '📄',
      title: 'RAMS & compliance documents',
      body: 'Risk assessments, method statements and insurance certificates provided before any job starts — ready for your health & safety file.',
    },
    {
      icon: '⚡',
      title: 'Fast drying times',
      body: 'Commercial-grade extraction equipment removes most moisture immediately. Most office carpets are dry and walkable within 2–3 hours.',
    },
    {
      icon: '📅',
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
    'RAMS and insurance certificates on request',
    'Out-of-hours and weekend visits available',
    'Monthly invoicing on 14-day payment terms (contract clients)',
    'No long lock-ins — 30 days’ notice, that’s it',
  ],

  pricingH2: 'Commercial carpet cleaning pricing',
  pricingIntro:
    'Commercial pricing is based on area, access and soiling level. We visit, measure and provide a fixed written quote the same day. No obligation.',
  pricingNote:
    'Send us your site address via WhatsApp and we will book a free survey within 48 hours. Every quote is fixed in writing before we start.',
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
      a: 'We price per area (square metres) with a minimum visit charge. We visit your site, measure the areas to clean, and provide a fixed written quote the same day — no obligation.',
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
      a: 'Yes. Many offices and landlords book us for quarterly or biannual deep cleans on a rolling contract. Regular clients get priority scheduling and consolidated monthly invoicing on 14-day terms.',
    },
  ],

  relatedLinks: [
    { href: '/commercial', label: 'All Commercial Services' },
    { href: '/carpet-cleaning-london', label: 'Residential Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/pricing', label: 'Pricing' },
  ],

  ctaH2: 'Get a fixed quote this week.',
  ctaBody:
    'We visit your site within 48 hours and deliver a written quote the same day. No obligation — and no surprises once work starts.',
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
