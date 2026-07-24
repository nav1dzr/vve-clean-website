import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';

const WA_PHOTO = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20an%20after-builders%20clean%20quote.%20Sending%20photos%20now.';

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'After Builders Cleaning London', item: 'https://vveclean.co.uk/after-builders-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'After Builders Cleaning London',
      description:
        'Post-construction cleaning in London from £199. We remove fine dust, paint specks, sticker residue and construction debris — leaving your space spotless and move-in ready.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/after-builders-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'After Builders Clean', price: '199', priceCurrency: 'GBP', description: 'From £199 — final price confirmed after a photo of the space.' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Why do you need a photo for the after-builders quote?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'After-builders work varies enormously from job to job. A light renovation leaves mostly fine dust; a full gut-and-rebuild can leave heavy debris, plaster dust and paint on every surface. A photo lets us assess the scope and give you an accurate fixed price, rather than underquoting and then revising on the day.',
          },
        },
        {
          '@type': 'Question',
          name: 'What does after-builders cleaning include?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We remove fine construction dust from all surfaces (including inside cupboards, sills and light fittings), remove paint splashes and adhesive residue from glass and hard surfaces, deep-clean the kitchen and bathrooms, and leave the space ready to move in or hand over. All equipment and products are supplied.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long does an after-builders clean take?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A 1-2 bedroom flat typically takes a full day (6–8 hours). Larger properties or those with extensive debris may require two visits. We give you an accurate time estimate with your quote.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can you clean while builders are still on site?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We need the builders to have finished their main work before we start — there is no point cleaning surfaces that will be dusty again the following day. We recommend booking us for the final clean after all trades have left.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do you supply materials and equipment?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. We bring everything needed — HEPA-filter vacuums, specialist dust-extraction equipment, glass scraper tools, cleaning solutions and all protective materials. You do not need to provide anything.',
          },
        },
      ],
    },
  ],
});

const DATA: ServiceLandingData = {
  schema: SCHEMA,
  breadcrumb: 'After Builders Cleaning London',

  eyebrow: 'Post-Construction Cleaning',
  h1: 'After Builders Cleaning London',
  h1Highlight: '— From £199, Quote by Photo',
  heroBadges: [
    'Fine dust & debris removal',
    'Paint splashes & sticker residue',
    'Move-in ready',
  ],
  primaryHref: WA_PHOTO,
  primaryLabel: 'WhatsApp a photo for a quote',
  primaryIsWa: true,
  secondaryHref: 'tel:02080502233',
  secondaryLabel: 'Call 020 8050 2233',

  introH2: 'Post-construction cleaning done properly',
  introText:
    'Builders sweep up — we deep-clean. After construction or renovation, fine plaster dust settles on every horizontal surface (including inside cupboards and light fittings), paint splashes dry on glass and tiles, and protective stickers leave adhesive residue on fixtures. A standard clean will not remove these — they require specialist techniques and equipment. We work across East London (E1–E17) and North London (N1–N19) and price every job by photo so you get an accurate fixed quote, not a surprise on the day.',

  benefitsH2: 'What makes after-builders cleaning a specialist job',
  benefits: [
    {
      icon: '🌫️',
      title: 'Fine dust removal',
      body: 'Construction dust is ultra-fine and gets everywhere — sills, inside cupboards, light fittings, vents. We use HEPA-filter vacuums and damp-wipe every surface, not just the obvious ones.',
    },
    {
      icon: '🖌️',
      title: 'Paint & adhesive removal',
      body: 'Paint splashes on glass, tiles and chrome — and adhesive from protective stickers on windows and fittings — need specialist scrapers and solvents. We remove them without scratching.',
    },
    {
      icon: '🚿',
      title: 'Kitchen & bathroom deep-clean',
      body: 'Builders often leave kitchens and bathrooms in poor condition. We deep-clean all surfaces, descale fittings, clean inside appliances and remove any remaining debris.',
    },
    {
      icon: '✅',
      title: 'Move-in or hand-over ready',
      body: 'We leave the space spotless — photographed and documented. Suitable for handover to clients, tenants, or simply moving in after a long renovation.',
    },
  ],

  whyH2: 'What every after-builders clean includes',
  whyPoints: [
    'HEPA-filter vacuuming of all surfaces, sills and vents',
    'Damp-wipe of all walls, skirting, ceilings and light fittings',
    'Paint splash and adhesive removal from glass and chrome',
    'Deep-clean of kitchen including inside appliances',
    'Full bathroom descale and sanitisation',
    'Inside-cupboard and inside-wardrobe clean',
    'All equipment and specialist cleaning products supplied',
    'Fixed price confirmed before we start — no day-of surprises',
  ],

  pricingH2: 'After-builders cleaning pricing',
  pricingIntro: 'Prices start from £199 and are confirmed by photo — scope varies too much for a fixed price list.',
  pricingNote:
    'Send us photos of the space via WhatsApp and we will confirm your fixed price within the hour. The extent of dust, paint and debris varies enormously from job to job — a photo lets us quote accurately so there are no surprises on the day.',
  pricingCta: {
    href: WA_PHOTO,
    label: 'WhatsApp photos for a quote',
    isWa: true,
  },

  faqs: [
    {
      q: 'Why do you need a photo for the quote?',
      a: 'After-builders work varies enormously from job to job. A light renovation leaves mostly fine dust; a full gut-and-rebuild can leave heavy debris, plaster dust and paint on every surface. A photo lets us assess the scope and give you an accurate fixed price, rather than underquoting and revising on the day.',
    },
    {
      q: 'What does after-builders cleaning include?',
      a: 'We remove fine construction dust from all surfaces (including inside cupboards, sills and light fittings), paint splashes and adhesive residue from glass and hard surfaces, deep-clean the kitchen and bathrooms, and leave the space ready to move in or hand over. All equipment and products are supplied.',
    },
    {
      q: 'How long does an after-builders clean take?',
      a: 'A 1–2 bedroom flat typically takes a full day (6–8 hours). Larger properties or those with extensive debris may require two visits. We give you an accurate time estimate with your quote.',
    },
    {
      q: 'Can you clean while builders are still on site?',
      a: 'We need the builders to have finished their main work before we start — there is no point cleaning surfaces that will be dusty again the following day. We recommend booking us for the final clean after all trades have left.',
    },
    {
      q: 'Do you supply materials and equipment?',
      a: 'Yes. We bring everything — HEPA-filter vacuums, specialist dust-extraction equipment, glass scraper tools, cleaning solutions and all protective materials. You do not need to provide anything.',
    },
  ],

  relatedLinks: [
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
  ],

  ctaH2: 'Ready to see your space properly clean?',
  ctaBody:
    'WhatsApp us a few photos and we will confirm your fixed price within the hour. No obligation, no surprises.',
  ctaPrimary: {
    href: WA_PHOTO,
    label: 'WhatsApp photos now',
    isWa: true,
  },
  ctaSecondary: { href: 'tel:02080502233', label: 'Call 020 8050 2233', isTel: true },
};

export default function AfterBuildersPage() {
  return <ServiceLandingLayout data={DATA} />;
}
