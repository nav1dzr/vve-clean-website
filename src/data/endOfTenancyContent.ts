import { GUARANTEE_SUMMARY, GUARANTEE_LIMIT } from './guarantee';
import {
  EOT_BASE_PRICES_P,
  EOT_TAILORED_START_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  EOT_GUARANTEE_HOURS,
} from './pricing';

// Shared by the current End of Tenancy page and its "The Work Behind" redesign,
// so the visible questions and the FAQPage/Service schema stay identical.
const p = (pence: number) => String(pence / 100);
const pDisplay = (pence: number) => `£${pence / 100}`;

// Single source for this page's questions. The visible accordion and the
// FAQPage schema are both generated from it, so the two can never drift —
// they previously did, and the schema copy of the re-clean guarantee had lost
// the exclusions the visible answer carried. See docs/BRAND_AND_UI_GUIDE.md
// ("Show FAQ text visibly whenever FAQ structured data is present").
export const FAQS = [
  {
    q: 'Can I share the cleaning details with my letting agent?',
    a: 'Yes. We list the work in your quote and can provide an itemised invoice with a cleaning completion record for your letting agent. A paid receipt is available once payment is recorded. Send any specific agent requirements before booking so we can check them against your chosen package. Complete includes the listed appliance and storage interiors; Tailored covers the tasks you select.',
  },
  {
    q: 'Is oven cleaning included?',
    a: 'Yes. The oven, hob, grill and extractor are included in both packages. Complete also includes the listed microwave, fridge/freezer, dishwasher, washing-machine and storage interiors. On Tailored, those other interiors are separate selections.',
  },
  {
    q: 'Which appliances are included in the Complete price?',
    a: 'Complete includes the oven, hob, grill, extractor, microwave interior, inside an emptied fridge and defrosted freezer, and accessible dishwasher and washing-machine compartments. Appliances must be empty and accessible; repairs and dismantling are not included. Tailored includes the oven, hob, grill and extractor, with other interiors priced individually.',
  },
  {
    q: `What is the ${EOT_GUARANTEE_HOURS / 24}-day re-clean guarantee?`,
    a: `${GUARANTEE_SUMMARY} ${GUARANTEE_LIMIT} The guarantee does not cover permanent damage, wear and tear, permanent stains, or new mess created after the team leaves.`,
  },
  {
    q: 'What is the difference between Complete and Tailored?',
    a: 'Complete is our recommended move-out clean, with the listed microwave, fridge/freezer, cupboard, dishwasher and washing-machine interiors included. Tailored starts with the core clean and a standard oven, hob, grill and extractor clean. Choose the other interiors you need and compare the total before requesting a time.',
  },
  {
    q: 'Do you work in occupied properties?',
    a: 'Not for this service. End of tenancy cleaning is for vacant properties, with belongings removed so we can reach the tasks in your quote. For carpet or upholstery cleaning in an occupied home, choose the relevant service.',
  },
  {
    q: 'What is not included in the price?',
    a: `Prices apply to normally maintained, vacant properties. Houses and maisonettes are priced separately from flats, shown in the quote calculator. Each additional bathroom beyond the first is +${pDisplay(EOT_EXTRA_BATH_P)}, and each additional separate WC is +${pDisplay(EOT_EXTRA_WC_P)}. Carpet steam cleaning, upholstery, exterior windows, balconies and rubbish removal are available as paid extras. Parking and the Congestion Charge are passed through at actual cost, confirmed with you before the booking is accepted. Heavy soiling, mould, biohazard contamination, pet accidents or extreme conditions require a photo review and confirmed quote before work starts.`,
  },
];

export const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.vveclean.co.uk' },
        { '@type': 'ListItem', position: 2, name: 'End of Tenancy Cleaning London', item: 'https://www.vveclean.co.uk/end-of-tenancy-cleaning-london' },
      ],
    },
    {
      '@type': 'Service',
      name: 'End of Tenancy Cleaning London',
      description:
        `End of tenancy cleaning across East and North London. Oven cleaning included in both packages, with listed appliance and storage interiors in Complete. ${EOT_GUARANTEE_HOURS / 24}-day reporting window for missed covered work and a cleaning completion record for your agent.`,
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean', url: 'https://www.vveclean.co.uk', telephone: '+442080502233' },
      areaServed: 'London',
      url: 'https://www.vveclean.co.uk/end-of-tenancy-cleaning-london',
      offers: [
        { '@type': 'Offer', name: 'Studio — Complete', price: p(EOT_BASE_PRICES_P.studio), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '1 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed1), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '2 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed2), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '3 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed3), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: '4 Bedroom — Complete', price: p(EOT_BASE_PRICES_P.bed4), priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Studio — Tailored (from)', price: p(EOT_TAILORED_START_PRICES_P.studio), priceCurrency: 'GBP' },
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
