import { CARPET_ITEM_PRICES_P } from './pricing';

// Sofa & upholstery FAQ and structured data, shared by the current page and
// the Work Behind redesign so the visible answers and the schema cannot drift.
const p = (pence: number) => String(pence / 100);

// Single source for the visible accordion and the FAQPage schema — see the
// same note in EndOfTenancyPage.tsx. The stain answer keeps the explicit
// "we never guarantee complete removal" wording in both places.
export const FAQS = [
  {
    q: 'How do I know if my sofa is safe to clean?',
    a: 'We check the fabric, care label and dye stability before choosing a cleaning method. Hot-water extraction is used only where the upholstery is suitable. If testing reveals a risk, we explain it before proceeding.',
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
    a: 'The result depends on the fabric, the stain and any treatment already used. Older marks or permanent colour changes may remain. We assess the likely result before cleaning and never guarantee complete stain removal.',
  },
  {
    q: 'Which upholstery items can I request?',
    a: 'The calculator lists fabric armchairs, two-seater and three-seater sofas, corner sofas and single, double and king mattresses. Tell us about unusual sizes, loose cushions or dining chairs so we can confirm the surfaces and price before booking. The visit minimum applies to the combined selection.',
  },
];

export const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Sofa Cleaning London', item: 'https://www.vveclean.co.uk/sofa-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Sofa & Upholstery Cleaning London',
      description:
        'Professional sofa and upholstery cleaning in London, with a fabric check and hot-water extraction where the material is suitable.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/sofa-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Armchair', price: p(CARPET_ITEM_PRICES_P.armchair), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2-seater sofa', price: p(CARPET_ITEM_PRICES_P.sofa_2), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3-seater sofa', price: p(CARPET_ITEM_PRICES_P.sofa_3), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Corner / L-shaped sofa', price: p(CARPET_ITEM_PRICES_P.sofa_corner), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Mattress (double)', price: p(CARPET_ITEM_PRICES_P.mattress_double), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Mattress (king)', price: p(CARPET_ITEM_PRICES_P.mattress_king), priceCurrency: 'GBP' },
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
