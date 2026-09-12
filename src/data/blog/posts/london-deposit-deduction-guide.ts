import type { BlogPost } from '../types';

// General guidance for England, with sources checked on the updated date.
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
  updatedDate: '2026-09-12',
  category: 'End of Tenancy',
  relatedServiceHref: '/end-of-tenancy-cleaning-london',
  relatedServiceLabel: 'End of Tenancy Cleaning',
  body: [
    {
      type: 'paragraph',
      content:
        'If you are moving out of a rented home in London, compare the check-in record with the condition at check-out and keep your evidence. This guide gives general information about deposit protection and disputes in England. It is not legal advice.',
    },
    { type: 'heading', text: 'Check how your deposit is protected', id: 'protection' },
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
        'Reasonable cleaning costs where the property was left less clean than at check-in',
        'Garden upkeep, if the tenancy agreement made this the tenant’s responsibility',
      ],
    },
    { type: 'heading', text: 'Fair wear and tear vs. damage', id: 'wear-and-tear' },
    {
      type: 'paragraph',
      content:
        'Fair wear and tear is deterioration through ordinary use over time. The age and condition of the item at check-in, and the length of the tenancy, matter when assessing a claim. A worn carpet is different from a new burn or broken fitting. Cleaning and damage also need to be considered separately: an older item can still be returned clean.',
    },
    {
      type: 'callout',
      content:
        'How long you lived in the property and the age/condition of an item at check-in both matter. A worn five-year-old carpet at check-out isn’t the same claim as a brand-new one with the same wear after six months.',
    },
    { type: 'heading', text: 'The cleaning standard and your evidence', id: 'cleaning' },
    {
      type: 'paragraph',
      content:
        'The starting point is the cleanliness recorded at check-in. You can clean the property yourself or choose a cleaning service to help reach that standard. Hiring a cleaner and achieving the required condition are different things; a paid receipt does not guarantee that every area meets the recorded standard.',
    },
    {
      type: 'paragraph',
      content:
        'The check-in inventory, tenancy terms and check-out evidence are important when cleanliness is disputed. A receipt can show that cleaning took place, but it does not by itself decide whether a deduction is valid. Keep dated photos, the inventory, the cleaning scope and any written comments from the agent or landlord.',
    },
    { type: 'heading', text: 'What to do if you disagree with a deduction', id: 'disputes' },
    {
      type: 'list',
      items: [
        'Compare the check-in and check-out inventories, including written descriptions and dated photos',
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
        'Before returning the keys, compare each room with the check-in record. Keep dated photos and written notes, including anything an image cannot show clearly. Save the cleaning task list and receipt if you used a service. These records help explain the condition at handover; they do not promise a particular deposit outcome.',
    },
  ],
  sources: [
    { label: 'GOV.UK: Tenancy deposit protection overview', href: 'https://www.gov.uk/tenancy-deposit-protection' },
    { label: 'GOV.UK: Information landlords must give tenants', href: 'https://www.gov.uk/tenancy-deposit-protection/information-landlords-must-give-tenants' },
    { label: 'GOV.UK: Deposit disputes and problems', href: 'https://www.gov.uk/tenancy-deposit-protection/disputes-and-problems' },
    { label: 'TDS: Cleaning standards and evidence', href: 'https://custodial.tenancydepositscheme.com/news/blog/asktds-can-my-landlord-charge-me-for-cleaning/' },
    { label: 'TDS: Reasonable deductions and wear', href: 'https://custodial.tenancydepositscheme.com/news/blog/asktds-what-can-i-use-my-tenants-deposit-for/' },
  ],
};
