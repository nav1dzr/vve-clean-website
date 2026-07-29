import ServiceLandingLayout, { type ServiceLandingData } from '../components/ServiceLandingLayout';
import EotGallery from '../components/EotGallery';
import QuoteCalculator from '../components/QuoteCalculator';
import { ClipboardList, PackageCheck, RefreshCw, Camera } from 'lucide-react';
import { EOT_BASE_PRICES_P, EOT_EXTRA_BATH_P, EOT_EXTRA_WC_P } from '../data/pricing';

const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20book%20an%20end%20of%20tenancy%20clean.';

const p = (pence: number) => String(pence / 100);
const pDisplay = (pence: number) => `£${pence / 100}`;

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
        'Complete end of tenancy cleaning across East and North London. Essential appliances, cupboards, internal windows, a 67-point checklist, 48-hour re-clean guarantee and photographic receipt included as standard.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://vveclean.co.uk/end-of-tenancy-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Studio', price: p(EOT_BASE_PRICES_P.studio), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '1 Bedroom', price: p(EOT_BASE_PRICES_P.bed1), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2 Bedroom', price: p(EOT_BASE_PRICES_P.bed2), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3 Bedroom', price: p(EOT_BASE_PRICES_P.bed3), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '4+ Bedroom', price: p(EOT_BASE_PRICES_P.bed4), priceCurrency: 'GBP' },
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
          name: 'Which appliances are included in the complete price?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The complete price includes the oven, hob, grill, extractor, inside an emptied fridge and defrosted freezer, and accessible dishwasher and washing-machine compartments. Appliances must be empty and accessible; repairs and dismantling are not included.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the 48-hour re-clean guarantee?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "If your letting agent or landlord flags any area of the clean within 48 hours of completion, we return to address it for free. We ask that you send us a copy of the agent's feedback so we can prioritise the right areas.",
          },
        },
        {
          '@type': 'Question',
          name: 'Do you work in occupied properties?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Not currently. We specialise in vacant properties — end of tenancy, move-in deep cleans, and after-builders work. The property needs to be empty to allow us to clean to the full 67-point standard.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is not included in the end of tenancy price?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Prices apply to normally maintained, vacant properties. Additional bathrooms beyond the first are +${pDisplay(EOT_EXTRA_BATH_P)} each; additional WC +${pDisplay(EOT_EXTRA_WC_P)}. Carpet steam cleaning, upholstery, exterior windows, balconies, full wall washing, parking, congestion and access costs are genuine extras. Heavy soiling, mould, biohazard contamination, pet accidents or extreme conditions require a photo review and a revised price agreed before work starts.`,
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
  h1: 'Complete End of Tenancy Cleaning London',
  h1Highlight: '— Everything Essential Included',
  heroBadges: [
    'Oven, fridge & freezer included',
    '48-hour re-clean guarantee',
    'Photographic receipt for your agent',
  ],
  primaryHref: '/end-of-tenancy-cleaning-london#quote',
  primaryLabel: 'Build my complete quote',
  secondaryHref: WA,
  secondaryLabel: 'WhatsApp us first',
  secondaryIsWa: true,

  introH2: 'One complete clean — not a cheap price with essential extras',
  introText:
    'Our Complete End of Tenancy Clean includes the work customers reasonably expect an inventory clean to cover: oven, hob and extractor; inside an emptied fridge and defrosted freezer; accessible appliance compartments; cupboards inside and out; descaled bathrooms; internal windows; skirting, doors, switches and floors. You choose the property size first, then add only genuine scope expansions such as carpet steam cleaning, an extra reception room or exterior windows. We cover East London (E1–E17) and North London (N1–N19) and provide a photographic receipt to support your checkout.',

  benefitsH2: 'Why tenants and landlords choose VVE Clean',
  benefits: [
    {
      icon: <ClipboardList size={28} />,
      title: '67-point agency checklist',
      body: 'Every item your letting agent checks at inventory — we clean it. No area is missed because we work from the same standard checklist agents use.',
    },
    {
      icon: <PackageCheck size={28} />,
      title: 'Essential appliances included',
      body: 'Oven, hob, extractor, emptied fridge, defrosted freezer and accessible appliance compartments are part of the complete package — not surprise add-ons.',
    },
    {
      icon: <RefreshCw size={28} />,
      title: '48-hour re-clean guarantee',
      body: "If your agent flags anything within 48 hours of your clean, we return to fix it for free. We ask only for a copy of the agent's written feedback.",
    },
    {
      icon: <Camera size={28} />,
      title: 'Photographic cleaning receipt',
      body: 'We photograph the property after cleaning so you have documented proof. Useful for any deposit dispute where the condition at checkout is questioned.',
    },
  ],

  whyH2: 'What every end of tenancy clean includes',
  whyPoints: [
    '67-point agency checklist — the same one your agent uses',
    'Oven, hob, grill and extractor — included',
    'Inside emptied fridge and defrosted freezer — included',
    'Accessible dishwasher and washing-machine compartments — included',
    'Inside all cupboards, drawers and wardrobes',
    'Bathrooms fully descaled, tiles, grouting and fixtures',
    'Internal windows cleaned streak-free',
    'Skirting boards, light switches and door frames wiped',
    '48-hour free re-clean if your agent flags anything',
    'Photographic cleaning receipt emailed on completion',
  ],

  pricingH2: 'Complete fixed prices by property size',
  pricingIntro:
    'The base price covers one kitchen, one living/reception room and one bathroom in a normally maintained, vacant property. There is no automatic house surcharge: the quote prices the rooms and genuine extra work.',
  pricingRows: [
    { label: 'Studio',                             price: pDisplay(EOT_BASE_PRICES_P.studio) },
    { label: '1 Bedroom / 1 bathroom',             price: pDisplay(EOT_BASE_PRICES_P.bed1) },
    { label: '2 Bedrooms / 1 bathroom',            price: pDisplay(EOT_BASE_PRICES_P.bed2) },
    { label: '3 Bedrooms / 1 bathroom',            price: pDisplay(EOT_BASE_PRICES_P.bed3) },
    { label: '4+ Bedrooms / 1 bathroom',           price: pDisplay(EOT_BASE_PRICES_P.bed4) },
    { label: 'Each additional full bathroom',      price: `+${pDisplay(EOT_EXTRA_BATH_P)}` },
    { label: 'Additional WC (half bathroom)',       price: `+${pDisplay(EOT_EXTRA_WC_P)}` },
  ],
  pricingNote:
    'Prices are customer totals; no VAT wording is added. Carpet steam cleaning, upholstery, exterior windows, extra rooms, parking/congestion and difficult access are separate only when they genuinely expand the job. Heavy soiling, mould, biohazard contamination, pet accidents or extreme conditions require a photo review and a revised price agreed before work starts.',
  pricingCta: { href: '/end-of-tenancy-cleaning-london#quote', label: 'Build my complete quote' },

  faqs: [
    {
      q: 'Does your clean meet letting agent standards?',
      a: 'Yes. We follow a 67-point checklist based on standard letting agency inventory requirements. This covers inside appliances, inside cupboards, descaling bathrooms, internal windows, skirting boards and more. We also provide a photographic cleaning receipt you can share with your agent.',
    },
    {
      q: 'Which appliances are included?',
      a: 'The complete price includes the oven, hob, grill, extractor, inside an emptied fridge and defrosted freezer, and accessible dishwasher and washing-machine compartments. Appliances must be empty and accessible; repairs and dismantling are not included.',
    },
    {
      q: 'What is the 48-hour re-clean guarantee?',
      a: "If your letting agent or landlord flags any area within 48 hours of completion, we return to address it for free. We ask that you send us a copy of the agent's written feedback so we can prioritise the right areas. The guarantee does not cover permanent damage, wear and tear, permanent stains, or new mess created after the team leaves.",
    },
    {
      q: 'Do you work in occupied properties?',
      a: 'Not currently. We specialise in vacant properties — the property needs to be empty to allow us to clean to the full 67-point standard.',
    },
    {
      q: 'What is not included in the price?',
      a: `Prices apply to normally maintained, vacant properties. Each additional bathroom beyond the first is +${pDisplay(EOT_EXTRA_BATH_P)}, and an additional WC is +${pDisplay(EOT_EXTRA_WC_P)}. Carpet steam cleaning, upholstery, exterior windows, balconies, full wall washing, parking, congestion and difficult access are genuine extras. Heavy soiling, mould, biohazard contamination, pet accidents or extreme conditions require a photo review and price agreement before work starts.`,
    },
    {
      q: 'Can I pay less if something is already cleaned?',
      a: 'Yes, for a small number of verifiable inspection items. The quote can apply a limited credit of up to £30, capped at 10% of the base price. The booking becomes a Custom EOT clean, and any removed item is excluded from the 48-hour re-clean guarantee.',
    },
  ],

  afterPricingSection: (
    <>
      <QuoteCalculator mode="eot" />
      <EotGallery />
    </>
  ),

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
