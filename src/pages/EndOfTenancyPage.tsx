import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20book%20an%20end%20of%20tenancy%20clean.';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'End of Tenancy Cleaning London', item: 'https://vveclean.co.uk/end-of-tenancy-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'End of Tenancy Cleaning London',
      description:
        'Inventory-grade end of tenancy cleaning across East and North London. 67-point agency checklist, free oven clean, 48-hour re-clean guarantee and photographic receipt included as standard.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/end-of-tenancy-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Studio', price: '159', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '1 Bedroom', price: '199', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2 Bedroom', price: '249', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3 Bedroom', price: '329', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '4+ Bedroom', price: '419', priceCurrency: 'GBP' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does your end of tenancy clean meet letting agent standards?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. We follow a 67-point checklist based on standard letting agency inventory requirements. This covers inside appliances, inside cupboards, descaling bathrooms, internal windows, skirting boards and more. We also provide a photographic cleaning receipt you can share with your agent.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is the oven clean really included for free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Oven cleaning is included in every end of tenancy clean at no extra cost. Most companies charge between £35–£45 extra for this. Hob, extractor filter and grill are included too.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the 48-hour re-clean guarantee?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'If your letting agent or landlord flags any area of the clean within 48 hours of completion, we return to address it for free. We ask that you send us a copy of the agent\'s feedback so we can prioritise the right areas.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do you work in occupied properties?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Not currently. We specialise in vacant properties — end of tenancy, move-in deep cleans, and after-builders work. The property needs to be empty and free of furniture to allow us to clean to the full 67-point standard.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is not included in the end of tenancy price?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The standard price covers the property in normal condition. Additional bathrooms beyond the first are +£20 each. Carpet cleaning, exterior windows, wall marks, key collection and rubbish removal are available as paid extras. Heavy mould, biohazard contamination, pet accidents or extreme soiling may require a revised quote.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'End of Tenancy Cleaning London',

  eyebrow: 'End of Tenancy Cleaning',
  h1: 'End of Tenancy Cleaning London',
  h1Highlight: '— 67-Point Agency Checklist',
  heroBadges: [
    'Free oven clean included',
    '48-hour re-clean guarantee',
    'Photographic receipt for your agent',
  ],
  primaryHref: '/booking',
  primaryLabel: 'Book your clean',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp us first',
  secondaryIsWa: true,

  introH2: 'The clean your agent actually checks for',
  introText:
    'End of tenancy cleans are not the same as a regular deep clean. Letting agents work from a detailed inventory checklist — and so do we. Our 67-point clean covers every item a standard agent inspection requires: inside appliances, inside cupboards, descaled bathrooms, internal windows, skirting boards, light switches and more. Oven cleaning is included free in every booking. We cover East London (E1–E17) and North London (N1–N19) and give you a photographic receipt to support your deposit return.',

  benefitsH2: 'Why tenants and landlords choose VVE Clean',
  benefits: [
    {
      icon: '📋',
      title: '67-point agency checklist',
      body: 'Every item your letting agent checks at inventory — we clean it. No area is missed because we work from the same standard checklist agents use.',
    },
    {
      icon: '🍳',
      title: 'Free oven clean included',
      body: 'Inside oven, hob, extractor filter and grill — all included at no extra cost. Most companies charge up to £45 extra for this alone.',
    },
    {
      icon: '🔄',
      title: '48-hour re-clean guarantee',
      body: 'If your agent flags anything within 48 hours of your clean, we return to fix it for free. We ask only for a copy of the agent\'s written feedback.',
    },
    {
      icon: '📸',
      title: 'Photographic cleaning receipt',
      body: 'We photograph the property after cleaning so you have documented proof. Useful for any deposit dispute where the condition at checkout is questioned.',
    },
  ],

  whyH2: 'What every end of tenancy clean includes',
  whyPoints: [
    '67-point agency checklist — the same one your agent uses',
    'Inside oven, hob, extractor filter and grill — free',
    'Inside all cupboards, drawers and wardrobes',
    'Bathrooms fully descaled, tiles, grouting and fixtures',
    'Internal windows cleaned streak-free',
    'Skirting boards, light switches and door frames wiped',
    '48-hour free re-clean if your agent flags anything',
    'Photographic cleaning receipt emailed on completion',
  ],

  pricingH2: 'Fixed end of tenancy cleaning prices',
  pricingIntro:
    'Prices are fixed by property size. The price you book is the price you pay — oven clean included in every booking.',
  pricingRows: [
    { label: 'Studio', price: '£159' },
    { label: '1 Bedroom', price: '£199' },
    { label: '2 Bedroom', price: '£249' },
    { label: '3 Bedroom', price: '£329' },
    { label: '4+ Bedroom', price: '£419' },
    { label: 'Additional bathroom (beyond the first)', price: '+£20' },
  ],
  pricingNote:
    'Prices are for properties in normal condition. Carpet cleaning, exterior windows, wall marks and rubbish removal are available as paid extras. Heavy soiling, mould or biohazard contamination may require a revised quote.',
  pricingCta: { href: '/booking', label: 'Book your clean now' },

  faqs: [
    {
      q: 'Does your clean meet letting agent standards?',
      a: 'Yes. We follow a 67-point checklist based on standard letting agency inventory requirements. This covers inside appliances, inside cupboards, descaling bathrooms, internal windows, skirting boards and more. We also provide a photographic cleaning receipt you can share with your agent.',
    },
    {
      q: 'Is the oven clean really included for free?',
      a: 'Yes. Oven cleaning is included in every end of tenancy clean at no extra cost. Most companies charge between £35–£45 extra for this. Hob, extractor filter and grill are also included.',
    },
    {
      q: 'What is the 48-hour re-clean guarantee?',
      a: 'If your letting agent or landlord flags any area within 48 hours of completion, we return to address it for free. We ask that you send us a copy of the agent\'s written feedback so we can prioritise the right areas.',
    },
    {
      q: 'Do you work in occupied properties?',
      a: 'Not currently. We specialise in vacant properties — the property needs to be empty to allow us to clean to the full 67-point standard.',
    },
    {
      q: 'What is not included in the price?',
      a: 'Additional bathrooms beyond the first are +£20 each. Carpet cleaning, exterior windows, wall marks, key collection and rubbish removal are available as paid extras. Heavy mould, biohazard contamination, pet accidents or extreme soiling may require a revised quote before work starts.',
    },
  ],

  relatedLinks: [
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa Cleaning' },
    { href: '/after-builders-cleaning-london', label: 'After Builders Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/booking', label: 'Book Online' },
  ],

  ctaH2: 'Book your end of tenancy clean today.',
  ctaBody:
    'Book online in 2 minutes. Pay a £30 deposit to secure your slot — balance due after you check the work.',
  ctaPrimary: { href: '/booking', label: 'Book online now' },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function EndOfTenancyPage() {
  return <ServiceLandingLayout data={DATA} />;
}
