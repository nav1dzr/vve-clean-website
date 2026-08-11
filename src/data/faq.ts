import {
  EOT_GUARANTEE_HOURS,
  COVERAGE_POSTCODE_LIST,
  SAME_DAY_POLICY_SHORT,
  EOT_CARPET_PACKAGE_DISCOUNT_PCT,
  EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS,
} from './pricing';

export interface FaqItem {
  q: string;
  a: string;
}

// Case/whitespace-insensitive comparison so "Can the price change?" and a
// hypothetical "can the price change? " are recognised as the same question.
export function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

// The homepage FAQ section (src/components/FAQ.tsx) imports this array
// directly rather than keeping its own copy — this is now the only place
// these 11 questions are written.
export const HOMEPAGE_FAQ_ITEMS: FaqItem[] = [
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
    q: 'Which areas do you cover?',
    a: `East and North London: ${COVERAGE_POSTCODE_LIST}. Just outside? WhatsApp us — if we can't help, we'll recommend someone good who can.`,
  },
  {
    q: 'Do you clean occupied homes?',
    a: 'Right now we specialise in vacant properties, commercial spaces and outdoor work — end of tenancy, move-in cleans, after-builders, offices, communal areas, windows, pressure washing and gardens. Regular cleaning of occupied homes is coming later once the team grows.',
  },
];

// The Pricing page's mini-FAQ (src/pages/PricingPage.tsx) imports this array
// rather than keeping its own copy.
export const PRICING_FAQ_ITEMS: FaqItem[] = [
  {
    q: 'When do I pay?',
    a: "£30 deposit by secure card link at booking. Balance is due after you've checked the work. Businesses are invoiced monthly.",
  },
  {
    q: 'Are prices really fixed?',
    a: 'Yes, for normally maintained properties. The only additions are extras you choose to add.',
  },
  {
    q: 'Can the price change?',
    a: 'Our prices are fixed for normal condition properties based on the details provided. For heavier conditions, we will review photos and confirm the price before you book. No hidden fees — any additional work is explained and agreed first.',
  },
  {
    q: 'Can I book same-day or next-day?',
    a: SAME_DAY_POLICY_SHORT,
  },
  {
    q: 'Do you clean occupied homes?',
    a: 'Not yet. We specialise in vacant properties, commercial spaces, and outdoor work.',
  },
];

// Questions that exist only on /faq — not duplicated from the homepage or
// Pricing page. Both use the canonical shared/pricingCatalogue.js values so
// the qualifying-area condition and guarantee scope can never drift out of
// sync with what the quote calculator and Pricing page actually enforce.
export const FAQ_ONLY_ITEMS: FaqItem[] = [
  {
    q: 'Can I add carpet cleaning to my end of tenancy booking?',
    a: `Yes. Add professional carpet steam cleaning to an End of Tenancy booking and save up to ${EOT_CARPET_PACKAGE_DISCOUNT_PCT}% off the standalone carpet-cleaning price — once you select ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} or more qualifying areas (bedrooms, living room, hallway, landing, stairs). Select fewer than ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS} and those areas are charged at the normal standalone rate — the discount only applies once the ${EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS}+ threshold is reached.`,
  },
  {
    q: 'What if my letting agent flags something after the clean?',
    a: `On the Complete End of Tenancy package, if the agent or landlord flags a cleaning issue within ${EOT_GUARANTEE_HOURS} hours of our visit, we come back and re-clean those specific areas free of charge. This covers the cleaning scope carried out — it does not cover pre-existing damage, wear and tear, or anything outside what was cleaned. The Tailored package and other services are not covered by this guarantee.`,
  },
];

// Canonical, deduplicated FAQ list for the /faq page: every question from
// HOMEPAGE_FAQ_ITEMS and PRICING_FAQ_ITEMS, plus FAQ_ONLY_ITEMS, with exact
// question-text duplicates ("When do I pay?", "Can the price change?", "Do
// you clean occupied homes?") kept once each — the fuller of the two
// answers is kept where they differ.
const seen = new Set<string>();
export const FAQ_ITEMS: FaqItem[] = [
  ...HOMEPAGE_FAQ_ITEMS,
  ...PRICING_FAQ_ITEMS,
  ...FAQ_ONLY_ITEMS,
].filter((item) => {
  const key = normalizeQuestion(item.q);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
