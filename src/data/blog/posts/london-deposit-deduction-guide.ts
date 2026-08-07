import type { BlogPost } from '../types';

// General, well-established guidance on tenancy deposit protection and
// deductions in England and Wales — the three scheme names (DPS, mydeposits,
// TDS) are the real, government-approved custodial/insured schemes; nothing
// here is a VVE-specific statistic or claim. See the "generic, well-
// established advice only" sourcing agreed for this content.
export const londonDepositDeductionGuide: BlogPost = {
  slug: 'london-deposit-deduction-guide',
  title: 'London Deposit Deduction Guide: What Landlords Can and Can’t Claim',
  excerpt:
    'A plain-English guide to tenancy deposit protection, common deduction reasons, wear and tear vs. damage, and how to dispute an unfair deduction in England and Wales.',
  publishedDate: '2026-08-07',
  category: 'End of Tenancy',
  relatedServiceHref: '/end-of-tenancy-cleaning-london',
  relatedServiceLabel: 'End of Tenancy Cleaning',
  body: [
    {
      type: 'paragraph',
      content:
        'If you’re moving out of a rented home in London, your deposit is very likely your biggest single incentive to get the handover right. This guide covers how deposit protection works, what a landlord can and can’t legitimately deduct for, and what to do if you disagree with a deduction.',
    },
    { type: 'heading', text: 'Your deposit has to be protected by law', id: 'protection' },
    {
      type: 'paragraph',
      content:
        'Since 2007, any landlord in England or Wales taking a deposit on an assured shorthold tenancy must protect it in one of three government-approved schemes within 30 days of receiving it:',
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
        'You should be given the scheme’s name, contact details and the "prescribed information" explaining how the protection works. If a landlord hasn’t protected your deposit correctly, you can raise this with the scheme directly.',
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
        'The tenancy agreement usually requires the property to be returned in a similar standard of cleanliness to check-in — not necessarily "professionally cleaned" unless the check-in inventory shows it was professionally cleaned beforehand. Ovens, extractor fans, bathroom grout and inside of appliances are the areas most often flagged, because everyday cleaning routines tend to skip them. A dated, itemised cleaning receipt from the move-out clean is one of the simplest pieces of evidence you can hold onto if a cleanliness deduction is raised later.',
    },
    { type: 'heading', text: 'What to do if you disagree with a deduction', id: 'disputes' },
    {
      type: 'list',
      items: [
        'Compare the check-in and check-out inventories side by side — photos with dates are the strongest evidence',
        'Ask the landlord or agent for an itemised breakdown and evidence of the actual cost (invoices, quotes)',
        'Reply in writing, explaining which items you dispute and why',
        'If you can’t agree, use the deposit scheme’s free alternative dispute resolution (ADR) service — this is available whenever the deposit was protected in a custodial or insured scheme, and doesn’t require going to court',
      ],
    },
    {
      type: 'paragraph',
      content:
        'The ADR adjudicator looks at the evidence both sides submit — photos, the inventory, receipts and correspondence — and their decision is binding on both parties for that dispute.',
    },
    { type: 'heading', text: 'Reducing the risk of a deduction', id: 'reducing-risk' },
    {
      type: 'paragraph',
      content:
        'Most disputes come down to a mismatch between the check-in and check-out condition, and cleanliness is one of the easiest parts of that to control. Photographing the property room by room before you hand back the keys, checking your tenancy agreement for what’s specifically expected, and keeping a dated receipt for any move-out cleaning all reduce the room for disagreement later.',
    },
  ],
};
