import { CARPET_ITEM_PRICES_P, STAIRS_FIRST_P } from './pricing';

// Carpet FAQ and structured data, shared by the current page and the Work
// Behind redesign so the visible answers and the schema cannot drift.
const p = (pence: number) => String(pence / 100);

// Single source for the visible accordion and the FAQPage schema — see the
// same note in EndOfTenancyPage.tsx.
export const FAQS = [
  {
    q: 'How long does carpet cleaning take?',
    a: 'A bedroom typically takes 20–30 minutes. A full 3-bedroom flat including hallways and living room usually takes 2–3 hours. We give you an estimated time when you book.',
  },
  {
    q: 'How long before the carpet is dry?',
    a: 'Carpets typically dry in 2–4 hours. Fibre, ventilation and room conditions affect the time. We explain drying and safe use after the clean.',
  },
  {
    q: 'Will you remove all stains?',
    a: 'Some coffee, wine, pet, mud and general-soiling marks can respond to treatment, but the result depends on the fibre, stain and products already used. Bleach, dye and permanent ink can leave a lasting mark. Complete removal cannot be guaranteed.',
  },
  {
    q: 'Do I need to move furniture before you arrive?',
    a: 'We ask that you move small items, toys and breakables off the carpet before we arrive. For large furniture like sofas and beds, we use furniture slides or clean around them where it makes sense. Let us know what you need when booking.',
  },
  {
    q: 'Do you clean rugs?',
    a: 'Yes, as an add-on to a carpet, upholstery or relevant end of tenancy clean. Send a photo first so the construction, fibre, cleaning method and price can be confirmed. We do not currently offer rug-only bookings.',
  },
  {
    q: 'How should I count rooms and stairs?',
    a: 'Choose a separate item for each bedroom, living room, hallway and landing. Use the large or through-lounge option where appropriate. Count each flight of stairs separately; the first and additional flights have different prices. Send photos if the layout does not fit these choices.',
  },
];

export const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'Carpet Cleaning London', item: 'https://www.vveclean.co.uk/carpet-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Carpet Cleaning London',
      description:
        'Professional hot-water extraction carpet cleaning for bedrooms, living rooms, stairs and hallways across East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/carpet-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Bedroom carpet clean', price: p(CARPET_ITEM_PRICES_P.bedroom), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Living / dining room carpet clean', price: p(CARPET_ITEM_PRICES_P.living_room), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Large or through lounge', price: p(CARPET_ITEM_PRICES_P.large_lounge), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Hallway carpet clean', price: p(CARPET_ITEM_PRICES_P.hallway), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Stairs — first flight', price: p(STAIRS_FIRST_P), priceCurrency: 'GBP' },
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
