import { EOT_GUARANTEE_HOURS } from './pricing';

// The end of tenancy re-clean guarantee's exact scope, in one place.
//
// These lists were previously inline in src/components/Guarantee.tsx, which
// renders on the homepage. §9 of the completion brief moves detailed
// guarantee exclusions to the page they belong to, so the homepage keeps the
// promise and /end-of-tenancy-cleaning-london carries the full breakdown.
// Sharing one source means the two can never disagree — the same failure the
// FAQ schema parity work fixed elsewhere (docs/FINAL_COMPLETION_LOG.md).
//
// Do not soften an exclusion to make the guarantee look broader. Every line
// here is a term the business has to honour.

export const GUARANTEE_COVERED = [
  'Missed areas from the original booked service',
  'Reported by you, your landlord or letting agent',
  `Reported within ${EOT_GUARANTEE_HOURS / 24} days of our visit`,
  'Supported by a report or photos',
];

export const GUARANTEE_NOT_COVERED = [
  'Wear and tear or pre-existing damage',
  'Permanent stains, mould staining, or limescale/corrosion damage',
  'Old paint marks or structural discolouration',
  'Odours from hidden sources (e.g. subfloor, inside walls)',
  'Rubbish removal not included in the original booking',
  'Areas we could not access during the clean',
  'Mess or damage created after the clean',
];

/** The promise itself, without the full covered/not-covered breakdown. */
export const GUARANTEE_SUMMARY =
  `If you, your landlord or letting agent report missed cleaning from the agreed scope within ` +
  `${EOT_GUARANTEE_HOURS / 24} days of our visit, send us the report or photos and we will return ` +
  `once to re-clean the missed areas, free of charge. Full agency-ready coverage applies to our ` +
  `Complete end of tenancy package; Tailored cleans are covered for the tasks selected.`;

export const GUARANTEE_LIMIT = "The reporting window runs from completion of the original clean. We agree a return time separately and need access to the affected areas. This voluntary cleaning promise does not guarantee the return of a tenancy deposit or limit your statutory rights.";
