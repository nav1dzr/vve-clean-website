import type { AreaInfo } from '../data/areas';
import { REVIEWS } from '../data/reviews';
import { matchesNamedArea } from './areaMatch';
import { collectAreaJobs } from '../components/gallery/RecentJobsByArea';

/**
 * True when an area currently has at least one piece of real proof: a
 * matching Google review, a tagged job photo/clip, or a true job note. This
 * is the single definition of "publishable" used both by AreaProofSection
 * (what renders on the page) and prerender.mjs (whether the page is
 * indexable) — see docs/LOCATION_PAGES_ASSESSMENT.md. An area flips to
 * indexable automatically the moment real proof is added; no code change
 * needed.
 */
export function areaHasRealProof(area: AreaInfo): boolean {
  const hasReview = REVIEWS.some((r) => matchesNamedArea(r.location, area.name));
  const hasJobItems = collectAreaJobs(area.name, area.postcodes).length > 0;
  const hasNotes = (area.jobNotes ?? []).length > 0;
  return hasReview || hasJobItems || hasNotes;
}
