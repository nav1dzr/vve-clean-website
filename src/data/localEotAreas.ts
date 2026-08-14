// Canonical data for the five implemented local end-of-tenancy landing pages.
//
// Only these five areas are real, routable pages — see AppRoutes.tsx and
// prerender.mjs. Every other name in components/Areas.tsx stays plain text
// until it has its own genuinely unique local page (see brief).
//
// Facts here are limited to: public geography (area/postcode/landmarks),
// general property/access characteristics of the area, and the site's own
// verified pricing/guarantee constants (imported, never re-typed). Nothing
// here claims job history, team presence, or availability in this area.

export interface LocalAreaFaq {
  q: string;
  a: string;
}

export interface LocalAreaConfig {
  slug: string;
  path: string;
  areaName: string;
  postcode: string;
  landmarks: [string, string];
  metaTitle: string;
  metaDescription: string;
  h1: string;
  h1Highlight: string;
  openingParagraph: string;
  /** Exactly two names from src/data/reviews.ts to show on this page. */
  reviewNames: [string, string];
  /** Exactly three local/materially-useful FAQs (combined with 3 universal ones). */
  localFaqs: [LocalAreaFaq, LocalAreaFaq, LocalAreaFaq];
  /** Slugs of exactly three other implemented local pages, per the approved nearby graph. */
  nearbySlugs: [string, string, string];
}

export const LOCAL_EOT_AREAS: LocalAreaConfig[] = [
  {
    slug: 'islington',
    path: '/end-of-tenancy-cleaning-islington',
    areaName: 'Islington',
    postcode: 'N1',
    landmarks: ['Angel', 'Upper Street'],
    metaTitle: 'End of Tenancy Cleaning Islington (N1) London | VVE Clean',
    metaDescription:
      'Local end of tenancy cleaning near Angel and Upper Street in Islington N1. Fixed pricing from £220, free oven clean, 72-hour guarantee.',
    h1: 'End of Tenancy Cleaning in Islington',
    h1Highlight: ' (N1)',
    openingParagraph:
      "Moving out of a flat near Angel or Upper Street brings its own checklist considerations. Islington's N1 postcode is a mix of Victorian conversions with original fireplaces and sash windows, mansion blocks with communal stairwells, and newer developments around the Regent's Canal fringe. Letting agents inspecting these properties typically check period features closely — skirting boards, window frames and any shared hallway carpet — alongside the usual kitchen and bathroom standards. Parking near Upper Street is largely permit-controlled, and many Angel blocks have entry-phone access rather than direct street parking outside, so it's worth telling us about access and any lift restrictions when you book. Whatever your property type, our end of tenancy service is built around the same 67-point checklist your agent's clerk is likely to use, with oven cleaning included free on every Complete booking and a 72-hour re-clean guarantee if anything is flagged afterwards. You can build your exact quote for a studio, one-bed or larger property in Islington using the calculator below, and choose between our Complete Agency-Ready package or a Tailored Checklist if you only need part of the job covered.",
    reviewNames: ['Hannah M.', 'Marcin P.'],
    localFaqs: [
      {
        q: 'Do you cover Islington and the N1 postcode?',
        a: "Yes — our mobile teams serve East and North London, including Islington and the surrounding N1 postcode around Angel and Upper Street. We don't have a walk-in branch in the area; every booking is arranged online, by phone or by WhatsApp.",
      },
      {
        q: 'What should I know before booking a clean near Angel or Upper Street?',
        a: 'Many Islington conversions near Angel and Upper Street have shared stairwells, entry-phone access or permit-controlled parking rather than direct access outside. Let us know about parking, building entry and any lift restrictions when you book, so the team can plan equipment and timing.',
      },
      {
        q: 'Which other areas near Islington do you cover?',
        a: 'We also publish local end of tenancy pages for Camden, Hackney and Walthamstow, alongside our main London end of tenancy service covering East and North London.',
      },
    ],
    nearbySlugs: ['camden', 'hackney', 'walthamstow'],
  },
  {
    slug: 'camden',
    path: '/end-of-tenancy-cleaning-camden',
    areaName: 'Camden',
    postcode: 'NW1',
    landmarks: ['Camden Market', "Regent's Canal"],
    metaTitle: 'End of Tenancy Cleaning Camden (NW1) London | VVE Clean',
    metaDescription:
      "Local end of tenancy cleaning near Camden Market and Regent's Canal in Camden NW1. Fixed pricing from £220, free oven clean, 72-hour guarantee.",
    h1: 'End of Tenancy Cleaning in Camden',
    h1Highlight: ' (NW1)',
    openingParagraph:
      "If you're moving out of a flat near Camden Market or along Regent's Canal, you'll already know NW1 has an unusually varied mix of housing. Canal-side developments and modern apartment blocks sit alongside Victorian terraces converted into flats above shops near the Market, many with narrow staircases and limited resident parking. Letting agents in this part of London tend to pay close attention to kitchen surfaces and appliance interiors given how compact Market-area kitchens often are, alongside any communal areas your tenancy agreement covers. Access can be a genuine factor here — some canal-side blocks use lift and fob entry, while older Market-side conversions may only have street access via a narrow side stair, so let us know what to expect before the team arrives. Our end of tenancy clean follows the same 67-point checklist a letting agent's clerk works from, with oven, hob and extractor cleaning included free on every Complete booking, and a 72-hour re-clean guarantee if your agent flags anything afterwards. Use the calculator below to build a fixed quote for your Camden property, choosing Complete Agency-Ready cover or a Tailored Checklist for just the tasks you need.",
    reviewNames: ['Ahmad B.', 'Snehal F.'],
    localFaqs: [
      {
        q: 'Do you cover Camden and the NW1 postcode?',
        a: "Yes — our mobile teams serve East and North London, including Camden and the surrounding NW1 postcode around Camden Market and Regent's Canal. We don't have a walk-in branch in the area; every booking is arranged online, by phone or by WhatsApp.",
      },
      {
        q: "What should I know before booking a clean near Camden Market or Regent's Canal?",
        a: 'Market-side conversions can have narrow staircases and limited resident parking, while some canal-side blocks use lift and fob entry. Let us know about parking, building access and any stairs or lifts when you book, so the team can plan equipment and timing.',
      },
      {
        q: 'Which other areas near Camden do you cover?',
        a: 'We also publish local end of tenancy pages for Islington, Hackney and Walthamstow, alongside our main London end of tenancy service covering East and North London.',
      },
    ],
    nearbySlugs: ['islington', 'hackney', 'walthamstow'],
  },
  {
    slug: 'hackney',
    path: '/end-of-tenancy-cleaning-hackney',
    areaName: 'Hackney',
    postcode: 'E8',
    landmarks: ['London Fields', 'Broadway Market'],
    metaTitle: 'End of Tenancy Cleaning Hackney (E8) London | VVE Clean',
    metaDescription:
      'Local end of tenancy cleaning near London Fields and Broadway Market in Hackney E8. Fixed pricing from £220, free oven clean, 72-hour guarantee.',
    h1: 'End of Tenancy Cleaning in Hackney',
    h1Highlight: ' (E8)',
    openingParagraph:
      'Flats near London Fields or Broadway Market cover a wide range of property types across E8 — Victorian conversions on the surrounding streets, ex-local authority blocks, and newer developments closer to the park. Many of these buildings have shared entrances, and some Broadway Market-side flats sit above shops with their own narrow staircases, so access is worth flagging when you book. Kitchens in this part of Hackney vary from galley layouts to open-plan spaces, and letting agents typically check appliance interiors and any communal carpet or hallway included in your tenancy just as closely as the flat itself. Whatever the layout, our end of tenancy clean works from the same 67-point checklist a letting agent\'s clerk is likely to use, with oven, hob and extractor cleaning included free on every Complete booking and a 72-hour re-clean guarantee if anything is flagged once you\'ve moved out. Build a fixed quote for your Hackney property using the calculator below — choose our Complete Agency-Ready package for full checklist cover, or a Tailored Checklist if you\'d rather add back only the internal tasks you need.',
    reviewNames: ['Sam M.', 'Hannah M.'],
    localFaqs: [
      {
        q: 'Do you cover Hackney and the E8 postcode?',
        a: "Yes — our mobile teams serve East and North London, including Hackney and the surrounding E8 postcode around London Fields and Broadway Market. We don't have a walk-in branch in the area; every booking is arranged online, by phone or by WhatsApp.",
      },
      {
        q: 'What should I know before booking a clean near London Fields or Broadway Market?',
        a: 'Some Broadway Market-side flats sit above shops with their own narrow staircases, and many nearby buildings have shared entrances. Let us know about parking, building access and stairs when you book, so the team can plan equipment and timing.',
      },
      {
        q: 'Which other areas near Hackney do you cover?',
        a: 'We also publish local end of tenancy pages for Islington, Stratford and Walthamstow, alongside our main London end of tenancy service covering East and North London.',
      },
    ],
    nearbySlugs: ['islington', 'stratford', 'walthamstow'],
  },
  {
    slug: 'stratford',
    path: '/end-of-tenancy-cleaning-stratford',
    areaName: 'Stratford',
    postcode: 'E15',
    landmarks: ['Westfield Stratford City', 'Queen Elizabeth Olympic Park'],
    metaTitle: 'End of Tenancy Cleaning Stratford (E15) London | VVE Clean',
    metaDescription:
      'Local end of tenancy cleaning near Westfield Stratford City and the Olympic Park in Stratford E15. Fixed pricing from £220, 72-hour guarantee.',
    h1: 'End of Tenancy Cleaning in Stratford',
    h1Highlight: ' (E15)',
    openingParagraph:
      "Moving out of a flat near Westfield Stratford City or the Queen Elizabeth Olympic Park usually means one of E15's newer high-rise developments, many with concierge entry, lift access and allocated parking rather than street parking. These buildings often have their own move-out procedures set by the managing agent as well as the letting agent, including booked lift slots for larger items, so it's worth telling us about building access when you book. Kitchens and bathrooms in newer Stratford blocks are typically finished to a high standard, and inspection checklists usually focus closely on appliance interiors, extractor fans and any balcony glass included in the tenancy. Our end of tenancy clean is built around the same 67-point checklist a letting agent's clerk works from, with oven, hob and extractor cleaning included free on every Complete booking, and a 72-hour re-clean guarantee if your agent flags anything afterwards. Use the calculator below to build a fixed quote for your Stratford property, whether that's a studio near the Westfield end or a larger flat closer to the Olympic Park, and choose between our Complete Agency-Ready and Tailored Checklist packages.",
    reviewNames: ['Marcin P.', 'Ahmad B.'],
    localFaqs: [
      {
        q: 'Do you cover Stratford and the E15 postcode?',
        a: "Yes — our mobile teams serve East and North London, including Stratford and the surrounding E15 postcode around Westfield Stratford City and the Queen Elizabeth Olympic Park. We don't have a walk-in branch in the area; every booking is arranged online, by phone or by WhatsApp.",
      },
      {
        q: 'What should I know before booking a clean near Westfield or the Olympic Park?',
        a: 'Many newer Stratford blocks use concierge entry, lift access and booked lift slots for larger items. Let us know about building access, parking and any booked-lift requirements when you book, so the team can plan equipment and timing.',
      },
      {
        q: 'Which other areas near Stratford do you cover?',
        a: 'We also publish local end of tenancy pages for Hackney, Walthamstow and Islington, alongside our main London end of tenancy service covering East and North London.',
      },
    ],
    nearbySlugs: ['hackney', 'walthamstow', 'islington'],
  },
  {
    slug: 'walthamstow',
    path: '/end-of-tenancy-cleaning-walthamstow',
    areaName: 'Walthamstow',
    postcode: 'E17',
    landmarks: ['Walthamstow Village', 'Lloyd Park'],
    metaTitle: 'End of Tenancy Cleaning Walthamstow (E17) London | VVE Clean',
    metaDescription:
      'Local end of tenancy cleaning near Walthamstow Village and Lloyd Park in Walthamstow E17. Fixed pricing from £220, 72-hour guarantee.',
    h1: 'End of Tenancy Cleaning in Walthamstow',
    h1Highlight: ' (E17)',
    openingParagraph:
      "Flats around Walthamstow Village or Lloyd Park span a real mix of property types — weatherboarded period cottages and Victorian terraces converted into flats near the Village, alongside larger ex-local authority blocks and newer builds closer to Lloyd Park. Older E17 conversions can have narrow stairs and limited off-street parking, especially around the Village's residents' parking bays, so it helps to flag access and parking when you book. Letting agents inspecting these properties tend to look closely at original features in period conversions — fireplaces, skirting boards and sash windows — alongside the standard kitchen and bathroom checks. Whatever the property type, our end of tenancy clean follows the same 67-point checklist a letting agent's clerk is likely to use, with oven, hob and extractor cleaning included free on every Complete booking, and a 72-hour re-clean guarantee if anything is flagged once you've handed back the keys. Build a fixed quote for your Walthamstow property using the calculator below, choosing our Complete Agency-Ready package or a Tailored Checklist if you only need part of the job covered.",
    reviewNames: ['Snehal F.', 'Sam M.'],
    localFaqs: [
      {
        q: 'Do you cover Walthamstow and the E17 postcode?',
        a: "Yes — our mobile teams serve East and North London, including Walthamstow and the surrounding E17 postcode around Walthamstow Village and Lloyd Park. We don't have a walk-in branch in the area; every booking is arranged online, by phone or by WhatsApp.",
      },
      {
        q: 'What should I know before booking a clean near Walthamstow Village or Lloyd Park?',
        a: "Older conversions near the Village can have narrow stairs and rely on residents' permit parking rather than direct access outside. Let us know about parking, stairs and building access when you book, so the team can plan equipment and timing.",
      },
      {
        q: 'Which other areas near Walthamstow do you cover?',
        a: 'We also publish local end of tenancy pages for Hackney, Stratford and Islington, alongside our main London end of tenancy service covering East and North London.',
      },
    ],
    nearbySlugs: ['hackney', 'stratford', 'islington'],
  },
];

export function getLocalArea(slug: string): LocalAreaConfig | undefined {
  return LOCAL_EOT_AREAS.find((a) => a.slug === slug);
}

export function getNearbyAreas(area: LocalAreaConfig): LocalAreaConfig[] {
  return area.nearbySlugs
    .map((slug) => getLocalArea(slug))
    .filter((a): a is LocalAreaConfig => Boolean(a));
}
