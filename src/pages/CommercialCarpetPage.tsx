import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import { Moon, FileText, Zap, Calendar } from 'lucide-react';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20commercial%20carpet%20clean%20please.%20Address%3A%20';

// Single source for the visible accordion and the FAQPage schema — see the
// same note in EndOfTenancyPage.tsx. The schema previously carried an
// unconfirmed claim about an existing client base and about priority
// scheduling and consolidated invoicing; only what is agreed in the written
// scope is stated here.
const FAQS = [
  {
    q: 'Can you clean commercial carpets outside business hours?',
    a: 'Early-morning, evening and weekend visits can be arranged. The visit window is agreed with you in writing before the work is confirmed, along with any keyholding or alarm arrangements the site needs.',
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
    a: 'Yes. Risk assessments and method statements are available on request at no extra charge, and the documents your site requires are confirmed in the written scope before work starts. We also carry £5m public liability insurance.',
  },
  {
    q: 'Can you set up a regular maintenance contract?',
    a: 'A maintenance schedule can be included in the quote. Visit frequency, invoicing and notice terms are agreed in writing before the contract starts.',
  },
];

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
        'Professional commercial carpet cleaning for offices, hotels and retail units across London. Out-of-hours visits can be arranged and RAMS are available on request — priced from the area and agreed scope, with a written quote before work starts.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/commercial-carpet-cleaning-london',
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
  breadcrumb: 'Commercial Carpet Cleaning London',

  eyebrow: 'Commercial Carpet Cleaning',
  h1: 'Commercial Carpet Cleaning London',
  h1Highlight: '— Offices, Hotels & Retail',
  heroBadges: [
    // Was "Out-of-hours visits available" — an unqualified standing claim.
    // The schema on this same page already says such visits "can be
    // arranged", which is the accurate framing.
    'Out-of-hours visits can be arranged',
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

  // Every card states only what is settled in the written scope before work
  // starts. Earlier wording promised no disruption, RAMS before any job, a
  // 2–3 hour drying time, priority booking and consolidated invoicing, and
  // implied an existing facilities-management client base — none of which is
  // confirmed. See docs/FINAL_COMPLETION_LOG.md.
  benefitsH2: 'What we agree before a commercial carpet clean',
  benefits: [
    {
      icon: <Moon size={28} />,
      title: 'Visit timing agreed in writing',
      body: 'Early-morning, evening and weekend windows can be arranged around your opening hours. The agreed window, site access and any keyholding arrangements are confirmed before the work is booked.',
    },
    {
      icon: <FileText size={28} />,
      title: 'RAMS available on request',
      body: 'Risk assessments and method statements are available on request at no extra charge, and the documents your site requires are listed in the written scope. £5m public liability insurance; certificate on request.',
    },
    {
      icon: <Zap size={28} />,
      title: 'Commercial extraction equipment',
      body: 'Hot-water extraction removes most of the moisture at the end of the clean. Drying time depends on the carpet construction, ventilation and site conditions, and we give you an estimate for your site after the inspection.',
    },
    {
      icon: <Calendar size={28} />,
      title: 'Maintenance schedule in the quote',
      body: 'A recurring schedule can be included in the written quote. Visit frequency, invoicing and notice terms are agreed in writing before the contract starts.',
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

  faqs: FAQS,

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
