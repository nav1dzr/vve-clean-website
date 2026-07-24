import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20a%20carpet%20clean%20quote.';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Carpet Cleaning London', item: 'https://vveclean.co.uk/carpet-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Carpet Cleaning London',
      description:
        'Professional hot-water extraction carpet cleaning in London. We remove stains, allergens and odours from bedrooms, living rooms, stairs and hallways across East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/carpet-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Bedroom carpet clean', price: '50', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Living / dining room carpet clean', price: '70', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Large or through lounge', price: '90', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Hallway carpet clean', price: '25', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Stairs — first flight', price: '55', priceCurrency: 'GBP' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How long does carpet cleaning take?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A bedroom typically takes 20–30 minutes. A full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long before the carpet is dry?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Carpets are usually dry within 2–4 hours. We use powerful extraction equipment that removes most of the moisture at the end of the clean, so drying is much faster than older steam methods.',
          },
        },
        {
          '@type': 'Question',
          name: 'Will you remove all stains?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We remove the vast majority of stains — coffee, wine, pet accidents, mud, and general soiling respond very well to hot-water extraction. Old, set-in stains or those from bleach, dye, or permanent inks may leave a residual trace. We will always tell you the likely outcome before we start.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need to move furniture before you arrive?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We ask that you move small items, toys and breakables off the carpet before we arrive. For large furniture like sofas and beds, we use furniture slides or clean around them where it makes sense. Let us know what you need when booking.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do you clean rugs?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Standard rugs start at £40. Larger or wool rugs may need a photo quote first to check the pile type and confirm they are safe for hot-water extraction. WhatsApp us a photo for a price in minutes.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'Carpet Cleaning London',

  eyebrow: 'Professional Carpet Cleaning',
  h1: 'Carpet Cleaning London',
  h1Highlight: '— Steam-Clean & Stain Removal',
  heroBadges: [
    'Hot-water extraction',
    'Dry in 2–4 hours',
    'DBS-checked technicians',
  ],
  primaryHref: '/booking',
  primaryLabel: 'Book a carpet clean',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp for a quote',
  secondaryIsWa: true,

  introH2: 'Deep carpet cleaning, not just surface freshening',
  introText:
    'We use professional hot-water extraction — the same method recommended by most carpet manufacturers. Hot water and cleaning solution are injected deep into the carpet pile, breaking up stains and bacteria, then extracted along with the dirt. The result is a carpet that looks cleaner, smells fresher and dries in hours, not days. We serve homes and rental properties across East London (E1–E17) and North London (N1–N19).',

  benefitsH2: 'What makes our carpet cleaning different',
  benefits: [
    {
      icon: '💧',
      title: 'Deep extraction, not surface scrubbing',
      body: 'Hot water penetrates deep into carpet fibres, loosening embedded grit, bacteria and allergens that surface cleaning leaves behind.',
    },
    {
      icon: '🌿',
      title: 'Removes allergens & pet odours',
      body: 'Dust mites, pet dander and pollen are significantly reduced. Embedded pet and smoke odours are neutralised at source, not masked.',
    },
    {
      icon: '⏱️',
      title: 'Dry in 2–4 hours',
      body: 'Our high-powered extraction equipment removes most of the water immediately. Your carpet is walkable far sooner than with cheaper, low-powered machines.',
    },
    {
      icon: '📋',
      title: 'Fixed prices, no surprises',
      body: 'Every price is listed clearly. The only additions are extras you choose — extra rooms, stairs or the rug bundle add-on.',
    },
  ],

  whyH2: 'What every carpet clean includes',
  whyPoints: [
    'Pre-inspection of carpet type and stain condition',
    'Pre-treatment spray on heavy soiling and stains',
    'Hot-water extraction with professional-grade equipment',
    'Post-clean grooming to restore carpet pile direction',
    'Furniture slides to protect floors while we work',
    'All equipment and cleaning products supplied',
    '£15 off if we arrive more than an hour late',
    'Free reschedule until 12pm the day before',
  ],

  pricingH2: 'Fixed carpet cleaning prices',
  pricingIntro:
    'Every room price below is fixed — the price you book is the price you pay. £85 minimum booking applies.',
  pricingRows: [
    { label: 'Bedroom', price: '£50' },
    { label: 'Living / dining room', price: '£70' },
    { label: 'Large or through lounge', price: '£90' },
    { label: 'Hallway', price: '£25' },
    { label: 'Landing', price: '£15' },
    { label: 'Stairs — first flight', price: '£55' },
    { label: 'Stairs — each additional flight', price: '£40' },
    { label: 'Rug (standard)', price: '£40' },
  ],
  pricingNote:
    'Large, wool or specialist rugs need a photo quote first. Add whole-home carpets to any end-of-tenancy clean and save £10.',
  pricingCta: { href: '/pricing', label: 'See all prices' },

  faqs: [
    {
      q: 'How long does carpet cleaning take?',
      a: 'A bedroom typically takes 20–30 minutes. A full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
    },
    {
      q: 'How long before the carpet is dry?',
      a: 'Carpets are usually dry within 2–4 hours. We use powerful extraction equipment that removes most of the moisture at the end of the clean, so drying is much faster than older steam methods.',
    },
    {
      q: 'Will you remove all stains?',
      a: 'We remove the vast majority of stains — coffee, wine, pet accidents, mud and general soiling respond very well to hot-water extraction. Old, set-in stains or those from bleach, dye or permanent ink may leave a residual trace. We will always tell you the likely outcome before we start.',
    },
    {
      q: 'Do I need to move furniture before you arrive?',
      a: 'We ask that you move small items, toys and breakables off the carpet before we arrive. For large furniture like sofas and beds, we use furniture slides or clean around them where it makes sense.',
    },
    {
      q: 'Do you clean rugs?',
      a: 'Yes. Standard rugs start at £40. Larger or wool rugs may need a quick photo quote to confirm they are safe for hot-water extraction. WhatsApp us a photo for a price within the hour.',
    },
  ],

  relatedLinks: [
    { href: '/sofa-cleaning-london', label: 'Sofa & Upholstery Cleaning' },
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Carpet Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Book Online' },
  ],

  ctaH2: 'Ready to book your carpet clean?',
  ctaBody:
    'Book online in 2 minutes and pay a £30 deposit. We confirm your slot within 1 hour during business hours.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function CarpetCleaningPage() {
  return <ServiceLandingLayout data={DATA} />;
}
