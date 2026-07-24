import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20sofa%20cleaning%20quote.';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Sofa Cleaning London', item: 'https://vveclean.co.uk/sofa-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Sofa & Upholstery Cleaning London',
      description:
        'Professional sofa and upholstery cleaning in London. Hot-water extraction removes stains, pet hair, odours and allergens from sofas, armchairs and mattresses.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/sofa-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Armchair', price: '50', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2-seater sofa', price: '75', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3-seater sofa', price: '95', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Corner / L-shaped sofa', price: '130', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Mattress (double/king)', price: '65', priceCurrency: 'GBP' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do I know if my sofa is safe to clean?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Before we start, we carry out a quick fabric and dye-stability test to confirm the upholstery is suitable for hot-water extraction. Most modern fabric sofas are compatible. We will tell you honestly if we think a different method would give a better result.',
          },
        },
        {
          '@type': 'Question',
          name: 'Will the colours run or fade?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We test for dye stability on every sofa before using any cleaning solution. If there is a risk of colour bleed, we will let you know before we start. We do not proceed without your agreement.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long before the sofa dries?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Most fabric sofas are dry within 3–6 hours. Thicker fabrics like velvet or chenille may take a little longer. Opening windows and keeping the room warm speeds up drying. We extract as much moisture as possible at the end of the clean.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do you clean leather sofas?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Not currently. Our upholstery cleaning service is for fabric sofas and chairs. Leather requires a specialist conditioning treatment that we do not offer at this time.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can you remove wine or food stains from a sofa?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'In most cases, yes. Fresh stains respond very well to hot-water extraction. Older, set-in stains may leave a faint residual mark — we will tell you the likely outcome during the pre-inspection. We never guarantee complete stain removal on old marks.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Sofa & Upholstery Cleaning London',

  eyebrow: 'Professional Upholstery Cleaning',
  h1: 'Sofa & Upholstery Cleaning London',
  h1Highlight: '— Fresh, Stain-Free & Dry in Hours',
  heroBadges: [
    'Hot-water extraction',
    'Colour-safe on most fabrics',
    'Removes pet odours & allergens',
  ],
  primaryHref: '/booking',
  primaryLabel: 'Book a sofa clean',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  introH2: 'Sofa cleaning that goes deeper than vacuuming',
  introText:
    'Vacuuming removes surface debris, but embedded pet hair, dust mites, food particles and odour-causing bacteria stay locked in the fibres. Our hot-water extraction process injects a cleaning solution deep into the upholstery, then extracts it along with the dirt — leaving your sofa visibly refreshed and genuinely hygienic. We cover East London (E1–E17) and North London (N1–N19), and we carry out a fabric-safety check on every sofa before we start.',

  benefitsH2: 'Why customers book sofa cleaning with us',
  benefits: [
    {
      icon: '🐾',
      title: 'Removes pet odours & hair',
      body: 'Embedded pet dander and odour-causing bacteria are extracted at source — not just masked with fragrance. Works on dog, cat and other pet allergens.',
    },
    {
      icon: '🔬',
      title: 'Reduces allergens',
      body: 'Dust mites, pollen and pet dander trapped deep in upholstery fibres are significantly reduced — important for allergy and asthma sufferers.',
    },
    {
      icon: '🎨',
      title: 'Colour-safe process',
      body: 'We test for dye stability before applying any product. If there is any risk, we tell you before we start — never after.',
    },
    {
      icon: '🛋️',
      title: 'Extends your sofa\'s life',
      body: 'Abrasive grit embedded in upholstery wears fibres from the inside. Regular cleaning removes it and slows visible wear — protecting your investment.',
    },
  ],

  whyH2: 'What every sofa clean includes',
  whyPoints: [
    'Pre-inspection and fabric/dye-stability test before we start',
    'Pre-treatment spray on stains and heavily soiled areas',
    'Hot-water extraction with professional upholstery attachment',
    'Deodourising treatment included as standard',
    'All equipment and cleaning products supplied',
    'Post-clean inspection — we check every cushion with you',
    '£15 off if we arrive more than an hour late',
    'Free reschedule until 12pm the day before',
  ],

  pricingH2: 'Fixed sofa cleaning prices',
  pricingIntro:
    'Every price below is fixed — the price you book is the price you pay. £85 minimum booking applies.',
  pricingRows: [
    { label: 'Armchair', price: '£50' },
    { label: '2-seater sofa', price: '£75' },
    { label: '3-seater sofa', price: '£95' },
    { label: 'Corner / L-shaped sofa', price: '£130' },
    { label: 'Mattress (single)', price: '£45' },
    { label: 'Mattress (double / king)', price: '£65' },
  ],
  pricingNote:
    'Combine a sofa and carpet clean on the same visit to save on the minimum booking threshold.',
  pricingCta: { href: '/pricing', label: 'See all prices' },

  faqs: [
    {
      q: 'How do I know if my sofa is safe to clean?',
      a: 'Before we start, we carry out a quick fabric and dye-stability test to confirm the upholstery is suitable for hot-water extraction. Most modern fabric sofas are compatible. We will tell you honestly if we think a different approach would give a better result.',
    },
    {
      q: 'Will the colours run or fade?',
      a: 'We test for dye stability on every sofa before applying any cleaning solution. If there is a risk of colour bleed, we let you know before we start. We do not proceed without your agreement.',
    },
    {
      q: 'How long before the sofa dries?',
      a: 'Most fabric sofas are dry within 3–6 hours. Thicker fabrics like velvet or chenille may take a little longer. Opening windows and keeping the room warm speeds up drying.',
    },
    {
      q: 'Do you clean leather sofas?',
      a: 'Not currently. Our upholstery service is for fabric sofas and chairs. Leather requires a specialist conditioning treatment that we do not offer at this time.',
    },
    {
      q: 'Can you remove wine or food stains?',
      a: 'In most cases, yes. Fresh stains respond very well. Older, set-in stains may leave a faint residual mark — we will tell you the likely outcome during the pre-inspection, never after the clean.',
    },
  ],

  relatedLinks: [
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Book Online' },
  ],

  ctaH2: 'Ready to book your sofa clean?',
  ctaBody:
    'Book online in 2 minutes and pay a £30 deposit to secure your slot. We confirm within 1 hour during business hours.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function SofaCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
