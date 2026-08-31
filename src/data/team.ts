// Team members shown on /about.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO ADD A TEAM MEMBER
//
// Add an entry to TEAM_MEMBERS below. Only `name` and `role` are required;
// every other field is optional and is simply omitted from the card when
// absent. Nothing renders at all while the array is empty, so the About page
// is complete and correct today and gains a team section the moment real
// people are added — no other code change needed.
//
// Rules that the tests in team.test.ts enforce:
//
//   * At most six members (the section is designed as a two- or three-column
//     grid; more than six turns it into a directory).
//   * `photo` must be a real file under /public. A member without a
//     photograph renders their initials, never an empty grey box and never a
//     stock face.
//   * `dbsChecked` is per-person, not a site-wide claim. The repository
//     already guards against a universal DBS claim
//     (src/pages/CarpetCleaningPage.dbs.test.tsx), because DBS scope is a
//     fact about individuals. Set it only for someone actually checked.
//
// Do not add a member until the details are confirmed. Placeholder people are
// worse than no team section.
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamMember {
  /** Full name as the customer would hear it on the phone. */
  name: string;
  /** Short role, e.g. 'Cleaning technician' or 'Operations'. */
  role: string;
  /**
   * Path to a photograph under /public, e.g. '/team/alex.avif'. Omit when no
   * approved photograph exists — the card falls back to initials.
   */
  photo?: string;
  /** One or two sentences. Omit rather than padding. */
  bio?: string;
  /** e.g. 'Eight years in end of tenancy cleaning'. Must be verifiable. */
  experience?: string;
  /** e.g. 'IICRC carpet cleaning certification'. Must be verifiable. */
  training?: string;
  /** Per-person DBS status. Never set this speculatively. */
  dbsChecked?: boolean;
}

export const TEAM_MEMBERS: readonly TeamMember[] = [];

export const MAX_TEAM_MEMBERS = 6;

/** Initials fallback for a member with no approved photograph. */
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
