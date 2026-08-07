import { Star } from 'lucide-react';
import type { AreaInfo } from '../../data/areas';
import { REVIEWS } from '../../data/reviews';
import { matchesArea } from '../../lib/areaMatch';
import { areaHasRealProof } from '../../lib/areaProof';
import { GoogleIcon } from '../Reviews';
import RecentJobsByArea from '../gallery/RecentJobsByArea';

/**
 * Real, area-specific proof for one area page: a matching Google review (if
 * one is tagged with this area), tagged job photos/clips, and true one-line
 * job notes. Renders null when none of the three exist, so the page never
 * implies local proof that isn't real — see docs/LOCATION_PAGES_ASSESSMENT.md.
 */
export default function AreaProofSection({ area }: { area: AreaInfo }) {
  if (!areaHasRealProof(area)) return null;

  const review = REVIEWS.find((r) => matchesArea(r.location, area.name, area.postcodes));
  const jobNotes = area.jobNotes ?? [];

  return (
    <section className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
          {area.name}, in their own words
        </h2>
      </div>

      {review && (
        <div className="bg-white border border-silver-200 rounded-2xl p-6 shadow-sm max-w-xl mx-auto mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-navy-900 text-sm font-semibold">{review.name}</span>
            <GoogleIcon size={17} />
          </div>
          <p className="text-navy-800 text-sm leading-relaxed mb-4">&ldquo;{review.text}&rdquo;</p>
          <div className="flex items-center justify-between text-silver-500 text-[11px]">
            <span>{review.location} · {review.date}</span>
            <span className="inline-flex items-center gap-1 text-royal-600 font-semibold">
              <Star size={12} className="fill-current" /> {review.service}
            </span>
          </div>
        </div>
      )}

      {jobNotes.length > 0 && (
        <ul className="max-w-xl mx-auto space-y-2 mb-4">
          {jobNotes.map((note) => (
            <li key={note} className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              {note}
            </li>
          ))}
        </ul>
      )}

      <RecentJobsByArea areaName={area.name} postcodes={area.postcodes} />
    </section>
  );
}
