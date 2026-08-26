import type { BlogPost } from '../types';

// General, well-established guidance on tenancy deposit protection and
// deductions in England and Wales — the three scheme names (DPS, mydeposits,
// TDS) are the real, government-approved custodial/insured schemes; nothing
// here is a VVE-specific statistic or claim. See the "generic, well-
// established advice only" sourcing agreed for this content.
export const londonDepositDeductionGuide: BlogPost = {
  slug: 'london-deposit-deduction-guide',
  title: 'London Deposit Deduction Guide: What Landlords Can and Can’t Claim',
  // The full title plus " | VVE Clean Blog" is 83 characters and truncates in
  // search results. The H1 keeps the longer, more descriptive version.
  seoTitle: 'Tenancy Deposit Deductions: What Landlords Can Claim',
  // 'Blog' is dropped from the suffix for posts with a seoTitle — see
  // prerender.mjs. Full: "Tenancy Deposit Deductions: What Landlords Can
  // Claim | VVE Clean" = 63 characters.
  excerpt:
    'A plain-English guide to tenancy deposit protection, common deduction reasons, wear and tear and disputes for renters in England.',
  publishedDate: '2026-08-07',
  category: 'End of Tenancy',
  relatedServiceHref: '/end-of-tenancy-cleaning-london',
  relatedServiceLabel: 'End of Tenancy Cleaning',
  body: [
    {
      type: 'paragraph',
      content:
        'If you are moving out of a rented home in London, compare the check-in record with the condition at check-out and keep your evidence. This guide gives general information about deposit protection and disputes in England. It is not legal advice.',
    },
    { type: 'heading', text: 'Your deposit has to be protected by law', id: 'protection' },
    {
      type: 'paragraph',
      content:
        'For deposits covered by the tenancy deposit protection rules in England, the landlord or agent must use a government-approved scheme and normally protect the money within 30 days of receiving it:',
    },
    {
      type: 'list',
      items: [
        'Deposit Protection Service (DPS) — custodial and insured options',
        'mydeposits — custodial and insured options',
        'Tenancy Deposit Scheme (TDS) — custodial and insured options',
      ],
    },
    {
      type: 'paragraph',
      content:
        'You should receive information about the scheme, how the deposit is protected and how disputes are handled. GOV.UK explains the options if you believe the deposit was not protected correctly; a court claim may be involved, so get advice before taking that step.',
    },
    { type: 'heading', text: 'What landlords can legitimately deduct for', id: 'legitimate-deductions' },
    {
      type: 'paragraph',
      content:
        'A deduction has to relate to a genuine loss, and the amount claimed should reasonably reflect that loss — not simply the full deposit "on principle". Common legitimate reasons include:',
    },
    {
      type: 'list',
      items: [
        'Unpaid rent or bills that were the tenant’s responsibility',
        'Damage beyond fair wear and tear (e.g. large stains, burns, broken fittings)',
        'Missing items listed on the inventory',
        'Professional cleaning, where the property was not returned in the condition described in the check-in inventory',
        'Garden upkeep, if the tenancy agreement made this the tenant’s responsibility',
      ],
    },
    { type: 'heading', text: 'Fair wear and tear vs. damage', id: 'wear-and-tear' },
    {
      type: 'paragraph',
      content:
        'Fair wear and tear is the gradual deterioration that happens through ordinary, everyday use — it isn’t something a landlord can charge for. Faded curtains from years of sunlight, slightly worn carpet in a well-used hallway, or small scuffs on paintwork are typically wear and tear. Damage is different: it’s harm caused by accident, neglect or misuse — a burn mark on a carpet, a cracked tile, or mould caused by not ventilating a room.',
    },
    {
      type: 'callout',
      content:
        'How long you lived in the property and the age/condition of an item at check-in both matter. A worn five-year-old carpet at check-out isn’t the same claim as a brand-new one with the same wear after six months.',
    },
    { type: 'heading', text: 'Cleaning is one of the most common deduction reasons', id: 'cleaning' },
    {
      type: 'paragraph',
      content:
        'The check-in inventory, tenancy terms and check-out evidence are important when cleanliness is disputed. A receipt can show that cleaning took place, but it does not by itself decide whether a deduction is valid. Keep dated photos, the inventory, the cleaning scope and any written comments from the agent or landlord.',
    },
    { type: 'heading', text: 'What to do if you disagree with a deduction', id: 'disputes' },
    {
      type: 'list',
      items: [
        'Compare the check-in and check-out inventories side by side — photos with dates are the strongest evidence',
        'Ask the landlord or agent for an itemised breakdown and evidence of the actual cost (invoices, quotes)',
        'Reply in writing, explaining which items you dispute and why',
        'If you cannot agree, check the dispute service and deadlines published by the scheme protecting the deposit',
      ],
    },
    {
      type: 'paragraph',
      content:
        'A deposit dispute is evidence-led. Keep the inventory, dated photos, receipts, quotes and written correspondence together so you can submit the records requested by the scheme.',
    },
    { type: 'heading', text: 'Reducing the risk of a deduction', id: 'reducing-risk' },
    {
      type: 'paragraph',
      content:
        'Most disputes come down to a mismatch between the check-in and check-out condition, and cleanliness is one of the easiest parts of that to control. Photographing the property room by room before you hand back the keys, checking your tenancy agreement for what’s specifically expected, and keeping a dated receipt for any move-out cleaning all reduce the room for disagreement later.',
    },
  ],
  sources: [
    { label: 'GOV.UK: Tenancy deposit protection overview', href: 'https://www.gov.uk/tenancy-deposit-protection' },
    { label: 'GOV.UK: Information landlords must give tenants', href: 'https://www.gov.uk/tenancy-deposit-protection/information-landlords-must-give-tenants' },
    { label: 'GOV.UK: Deposit disputes and problems', href: 'https://www.gov.uk/tenancy-deposit-protection/disputes-and-problems' },
  ],
};
