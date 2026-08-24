// Local area landing page data — 15 areas, each carrying only facts that are
// actually true today:
//
//   - `postcodes` are drawn ONLY from COVERAGE_POSTCODES (../../shared/
//     pricingCatalogue.js — the single canonical coverage list also used to
//     price every booking). An area with no code in that list gets an empty
//     array rather than a guessed postcode — see Highgate below.
//   - `neighbourAreas` are drawn ONLY from the names already published in
//     Areas.tsx / AreaMarquee.tsx (existing site-wide coverage lists).
//   - `jobNotes` are true, one-line job notes ("three-bed terrace, E17, end
//     of tenancy") with no invented outcome. Empty until the owner supplies
//     one — never fabricated to fill the slot.
//
// Reviews and tagged job photos are NOT stored here: AreaProofSection matches
// them dynamically against REVIEWS (../data/reviews) and the gallery/carpet
// manifests via matchesArea (../lib/areaMatch), so a new tagged review or
// photo becomes visible the moment it's added — no code change needed.
//
// See docs/LOCATION_PAGES_ASSESSMENT.md for why these pages previously
// weren't published, and its addendum for why they are now.

export interface AreaInfo {
  slug: string;
  name: string;
  postcodes: string[];
  neighbourAreas: string[];
  jobNotes?: string[];
  coverageConfirmed?: boolean;
}

export const AREAS: AreaInfo[] = [
  {
    slug: 'islington',
    name: 'Islington',
    postcodes: ['N1', 'N5', 'N7'],
    neighbourAreas: ['Angel', 'Highbury', 'Holloway', 'Finsbury Park'],
  },
  {
    slug: 'stratford',
    name: 'Stratford',
    postcodes: ['E15', 'E20'],
    neighbourAreas: ['Bow', 'Hackney Wick', 'Leyton', 'Homerton'],
  },
  {
    slug: 'hackney',
    name: 'Hackney',
    postcodes: ['E8', 'E9'],
    neighbourAreas: ['Dalston', 'London Fields', 'Homerton', 'Clapton'],
  },
  {
    slug: 'shoreditch',
    name: 'Shoreditch',
    postcodes: ['E1', 'E2'],
    neighbourAreas: ['Hoxton', 'Old Street', 'Bethnal Green', 'Whitechapel'],
  },
  {
    slug: 'walthamstow',
    name: 'Walthamstow',
    postcodes: ['E17'],
    neighbourAreas: ['Leyton', 'Tottenham', 'Clapton'],
  },
  {
    slug: 'bethnal-green',
    name: 'Bethnal Green',
    postcodes: ['E2'],
    neighbourAreas: ['Shoreditch', 'Whitechapel', 'London Fields', 'Hackney'],
  },
  {
    slug: 'dalston',
    name: 'Dalston',
    postcodes: ['E8'],
    neighbourAreas: ['Hackney', 'Stoke Newington', 'London Fields', 'Hoxton'],
  },
  {
    slug: 'stoke-newington',
    name: 'Stoke Newington',
    postcodes: ['N16'],
    neighbourAreas: ['Dalston', 'Clapton', 'Finsbury Park'],
  },
  {
    slug: 'bow',
    name: 'Bow',
    postcodes: ['E3'],
    neighbourAreas: ['Mile End', 'Hackney Wick', 'Poplar', 'Stratford'],
  },
  {
    slug: 'finsbury-park',
    name: 'Finsbury Park',
    postcodes: ['N4'],
    neighbourAreas: ['Stoke Newington', 'Highbury', 'Crouch End', 'Holloway'],
  },
  {
    slug: 'angel',
    name: 'Angel',
    postcodes: ['N1'],
    neighbourAreas: ['Islington', 'Highbury', 'Old Street'],
  },
  {
    slug: 'camden',
    name: 'Camden',
    postcodes: ['NW1'],
    neighbourAreas: ['Islington', 'Highgate', 'Holloway'],
  },
  {
    slug: 'highgate',
    name: 'Highgate',
    // Highgate's own postcode (N6) isn't in the canonical coverage list
    // today — left empty rather than asserting coverage of a code that
    // hasn't actually been confirmed. The page still stands on its real
    // neighbouring covered areas below.
    postcodes: [],
    coverageConfirmed: false,
    neighbourAreas: ['Crouch End', 'Camden', 'Holloway'],
  },
  {
    slug: 'tottenham',
    name: 'Tottenham',
    postcodes: ['N15', 'N17'],
    neighbourAreas: ['Walthamstow', 'Wood Green'],
  },
  {
    slug: 'canary-wharf',
    name: 'Canary Wharf',
    postcodes: ['E14'],
    neighbourAreas: ['Poplar', 'Limehouse'],
  },
];

export const AREAS_BY_SLUG: Record<string, AreaInfo> = Object.fromEntries(
  AREAS.map((area) => [area.slug, area]),
);
