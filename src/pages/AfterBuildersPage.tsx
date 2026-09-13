import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import { Wind, Paintbrush, Droplets, CheckCircle2 } from 'lucide-react';
import { AFTER_BUILDERS_FROM_PRICES_P, AFTER_BUILDERS_START_FROM_P } from '../data/pricing';

const WA_PHOTO = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20an%20after-builders%20clean%20quote.%20Sending%20photos%20now.';

// Single source for the visible accordion and the FAQPage schema — see the
// same note in EndOfTenancyPage.tsx.
const FAQS = [
  {
    q: 'Why do you need a photo for the quote?',
    a: 'Photos help us assess the dust, residue, surfaces and work left by the builders. Send an overview of each room and close-ups of problem areas. We may ask for more information before confirming the tasks, price and likely time needed.',
  },
  {
    q: 'What does after-builders cleaning include?',
    a: 'The quote can cover construction dust on accessible surfaces, cupboard interiors, sills and fittings, kitchen and bathroom cleaning, and suitable treatment of paint or adhesive residue. The surface and condition determine what can be removed. Your quote lists the agreed work; equipment and products for that work are supplied.',
  },
  {
    q: 'How long does an after-builders clean take?',
    a: 'A 1–2 bedroom flat typically takes a full day (6–8 hours). Larger properties or those with extensive debris may require two visits. We give you an accurate time estimate with your quote.',
  },
  {
    q: 'Can you clean while builders are still on site?',
    a: 'Book the final clean after the builders have finished their main work and the trades have left. Tell us if any work will still be happening, since fresh dust can settle on areas already cleaned.',
  },
  {
    q: 'Do you supply materials and equipment?',
    a: 'Yes. We bring the equipment, cleaning products and protective materials for the agreed tasks. Confirm access and parking in advance and tell us about any site restrictions when requesting the quote.',
  },
  {
    q: 'Are walls, ceilings and waste removal included?',
    a: 'Show us these areas and any remaining debris in your photos. We need to agree the surfaces, access and any waste-removal work in the quote. Do not assume that cleaning includes repairs, repainting or clearance of building waste.',
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'After Builders Cleaning London', item: 'https://www.vveclean.co.uk/after-builders-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'After Builders Cleaning London',
      description:
        `After-builders cleaning in London from £${AFTER_BUILDERS_START_FROM_P / 100}. Photo assessment of dust, paint and adhesive residue, with cleaning tasks and the final quote confirmed before work starts.`,
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/after-builders-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'After Builders Clean', price: String(AFTER_BUILDERS_START_FROM_P / 100), priceCurrency: 'GBP', description: `From £${AFTER_BUILDERS_START_FROM_P / 100} — estimated price confirmed by photo before work starts.` },
        { '@type': 'Offer', name: 'After Builders — Studio', price: String(AFTER_BUILDERS_FROM_PRICES_P.studio / 100), priceCurrency: 'GBP', description: `From £${AFTER_BUILDERS_FROM_PRICES_P.studio / 100} — studio flat.` },
        { '@type': 'Offer', name: 'After Builders — 1 Bedroom', price: String(AFTER_BUILDERS_FROM_PRICES_P.bed1 / 100), priceCurrency: 'GBP', description: `From £${AFTER_BUILDERS_FROM_PRICES_P.bed1 / 100} — 1 bedroom.` },
        { '@type': 'Offer', name: 'After Builders — 2 Bedrooms', price: String(AFTER_BUILDERS_FROM_PRICES_P.bed2 / 100), priceCurrency: 'GBP', description: `From £${AFTER_BUILDERS_FROM_PRICES_P.bed2 / 100} — 2 bedrooms.` },
        { '@type': 'Offer', name: 'After Builders — 3 Bedrooms', price: String(AFTER_BUILDERS_FROM_PRICES_P.bed3 / 100), priceCurrency: 'GBP', description: `From £${AFTER_BUILDERS_FROM_PRICES_P.bed3 / 100} — 3 bedrooms.` },
        { '@type': 'Offer', name: 'After Builders — 4 Bedrooms', price: String(AFTER_BUILDERS_FROM_PRICES_P.bed4 / 100), priceCurrency: 'GBP', description: `From £${AFTER_BUILDERS_FROM_PRICES_P.bed4 / 100} — 4 bedrooms.` },
      ],
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
  breadcrumb: 'After Builders Cleaning London',

  eyebrow: 'Post-Construction Cleaning',
  h1: 'After Builders Cleaning London',
  h1Highlight: '',
  heroSubtitle: 'Post-renovation cleaning, quoted from your photos and the scope of the work.',
  heroPriceChip: `From £${AFTER_BUILDERS_START_FROM_P / 100} · final quote after photo review`,
  heroBadges: [
    'Construction dust cleaning',
    'Residue assessed before treatment',
    'Photo quote before booking',
  ],
  primaryHref: WA_PHOTO,
  primaryLabel: 'WhatsApp a photo for a quote',
  primaryIsWa: true,
  secondaryHref: 'tel:02080502233',
  secondaryLabel: 'Call 020 8050 2233',

  introH2: 'Tell us what the builders have left',
  introText:
    'Fine dust can remain in cupboards, on sills and around fittings after renovation. Paint splashes and protective stickers need a different assessment from ordinary dirt. Send the postcode, property size, photographs and intended handover date so we can quote for the work your property needs.',

  benefitsH2: 'What makes after-builders cleaning a specialist job',
  benefits: [
    {
      icon: <Wind size={28} />,
      title: 'Fine dust removal',
      body: 'We vacuum and wipe the accessible surfaces listed in the quote, including relevant sills, cupboard interiors and fittings. Tell us about hard-to-reach areas before booking.',
    },
    {
      icon: <Paintbrush size={28} />,
      title: 'Paint & adhesive removal',
      body: 'Paint splashes on glass, tiles and chrome — and adhesive from protective stickers on windows and fittings — need specialist scrapers and solvents. We assess the surface and residue before choosing a suitable tool or treatment. Existing damage and permanent marks cannot be cleaned away.',
    },
    {
      icon: <Droplets size={28} />,
      title: 'Kitchen & bathroom deep-clean',
      body: 'The quote identifies the kitchen, bathroom and appliance work needed after the building work. We assess scale, dust and residue before choosing suitable cleaning products.',
    },
    {
      icon: <CheckCircle2 size={28} />,
      title: 'Move-in or hand-over ready',
      body: 'We finish the agreed scope and photograph the result, so the condition at handover is documented. Suitable for handover to clients, tenants, or simply moving in after a long renovation.',
    },
  ],

  whyH2: 'Tasks to confirm in your quote',
  whyPoints: [
    'Dust removal from accessible surfaces, sills and fittings',
    'Wall, ceiling and high-level work assessed before inclusion',
    'Paint and adhesive treatment where suitable for the surface',
    'Kitchen cleaning and selected appliance interiors',
    'Bathroom cleaning and descaling',
    'Empty cupboard and wardrobe interiors',
    'All equipment and specialist cleaning products supplied',
    'Tasks and final price agreed before work starts',
  ],

  pricingH2: 'After-builders cleaning pricing',
  pricingIntro: `Prices start from £${AFTER_BUILDERS_START_FROM_P / 100} and are estimated by photo before any work starts — scope varies too much for a fixed price list.`,
  pricingRows: [
    { label: 'Small renovation / one main area', price: `from £${AFTER_BUILDERS_FROM_PRICES_P.small / 100}` },
    { label: 'Studio flat',                      price: `from £${AFTER_BUILDERS_FROM_PRICES_P.studio / 100}` },
    { label: '1 bedroom',                         price: `from £${AFTER_BUILDERS_FROM_PRICES_P.bed1 / 100}` },
    { label: '2 bedrooms',                        price: `from £${AFTER_BUILDERS_FROM_PRICES_P.bed2 / 100}` },
    { label: '3 bedrooms',                        price: `from £${AFTER_BUILDERS_FROM_PRICES_P.bed3 / 100}` },
    { label: '4 bedrooms',                        price: `from £${AFTER_BUILDERS_FROM_PRICES_P.bed4 / 100}` },
    { label: '5+ bedrooms / large commercial',    price: 'Site survey — manual quote' },
  ],
  pricingNote:
    'Send us photos of the space via WhatsApp. The extent of dust, paint and debris varies enormously from job to job, so photos help us review the scope and confirm a useful price before work starts.',
  pricingCta: {
    href: WA_PHOTO,
    label: 'WhatsApp photos for a quote',
    isWa: true,
  },

  faqs: FAQS,
  sectionOrder: ['intro', 'benefits', 'why', 'pricing', 'faq', 'related'],

  relatedLinks: [
    { href: '/end-of-tenancy-cleaning-london', label: 'End of Tenancy Cleaning' },
    { href: '/carpet-cleaning-london', label: 'Carpet Cleaning' },
    { href: '/sofa-cleaning-london', label: 'Sofa Cleaning' },
    { href: '/commercial-carpet-cleaning-london', label: 'Commercial Cleaning' },
    { href: '/pricing', label: 'All Prices' },
    { href: '/contact', label: 'Send an enquiry' },
  ],

  ctaH2: 'Send photos for an after-builders quote',
  ctaBody:
    'WhatsApp us a few photos and the property details so we can review the scope and confirm a price before work starts.',
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
