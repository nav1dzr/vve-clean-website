import { EOT_GUARANTEE_HOURS, COVERAGE_POSTCODE_LIST, SAME_DAY_POLICY_SHORT } from './pricing';

export interface FaqItem {
  q: string;
  a: string;
}

// Canonical, deduplicated FAQ list for the /faq page.
//
// Merges every question from the homepage FAQ (src/components/FAQ.tsx) and
// the Pricing page mini-FAQ (src/pages/PricingPage.tsx). Where both asked the
// same question — "When do I pay?", "Can the price change?", "Do you clean
// occupied homes?" — the fuller of the two answers is kept once. Everything
// else from both sources is included unchanged. This file is additive: the
// homepage and pricing components keep their own copies so neither is
// refactored by adding this page.
export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'How does the deposit-back guarantee work?',
    a: `We clean to a 67-point checklist that mirrors the standard London letting-agency inventory form — the same document your check-out clerk uses. If the agent or landlord flags any cleaning issue within ${EOT_GUARANTEE_HOURS} hours of our visit (Complete package), we come back and re-clean those areas free of charge. Cleaning is the single biggest cause of deposit deductions in London — this is how we remove it from the equation.`,
  },
  {
    q: "What's included in an end of tenancy clean?",
    a: 'Every Complete End of Tenancy Clean covers the kitchen including the oven, hob, extractor, emptied fridge and defrosted freezer, accessible appliance compartments, cupboards inside and out, descaled bathrooms, internal windows, skirting boards, doors, switches and all floors. Carpet steam cleaning, exterior windows and other genuine scope expansions are shown separately.',
  },
  {
    q: 'Are your cleaners insured and vetted?',
    a: 'Yes. Every cleaner is DBS-checked and we carry £5m public liability insurance. Happy to show certificates before your booking — just ask on WhatsApp.',
  },
  {
    q: 'Do I need to be home during the clean?',
    a: 'No. Most end of tenancy customers leave keys with us or with the agent. We send photos when the job is done and return keys however suits you.',
  },
  {
    q: 'Do you bring equipment and products?',
    a: 'Yes — everything is included in the price. Professional equipment, professional products. Nothing to provide, nothing extra to pay.',
  },
  {
    q: 'When do I pay?',
    a: "A £30 deposit is paid by secure card link when you submit your booking request (it comes off your total) — we confirm availability within one business hour. The balance is due on completion, after you've checked the work — card link, bank transfer or cash. Businesses are invoiced monthly with 14-day payment terms.",
  },
  {
    q: 'Are prices really fixed?',
    a: 'Yes, for normally maintained properties. The only additions are extras you choose to add.',
  },
  {
    q: 'Can the price change?',
    a: 'Our prices are fixed for normal condition properties based on the details provided. If we arrive and the property has heavy soiling, mould, excessive rubbish, biohazard contamination, strong odours, pet accidents, or large/permanent stains, we will explain the issue and confirm any revised price before starting.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: "Yes — free of charge until 12pm the day before your booking. After that the £30 deposit covers the reserved slot, since we'll have turned other work away for it. To move a booking, just message us on WhatsApp.",
  },
  {
    q: 'How quickly can you come?',
    a: "Book by 12pm and we can usually clean the same day or next day. End-of-month slots go fastest — if you're moving out, book your date as soon as you have it.",
  },
  {
    q: 'Can I book same-day or next-day?',
    a: SAME_DAY_POLICY_SHORT,
  },
  {
    q: 'Which areas do you cover?',
    a: `East and North London: ${COVERAGE_POSTCODE_LIST}. Just outside? WhatsApp us — if we can't help, we'll recommend someone good who can.`,
  },
  {
    q: 'Do you clean occupied homes?',
    a: 'Right now we specialise in vacant properties, commercial spaces and outdoor work — end of tenancy, move-in cleans, after-builders, offices, communal areas, windows, pressure washing and gardens. Regular cleaning of occupied homes is coming later once the team grows.',
  },
];
