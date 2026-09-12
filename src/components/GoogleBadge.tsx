import { Star } from 'lucide-react';
import { GOOGLE_PROFILE_LINK, GoogleIcon } from './Reviews';
import { useGoogleRating } from '../hooks/useGoogleRating';
import { googleRatingSourceLabel } from '../lib/googleRatingDisplay';

export default function GoogleBadge({ className = '' }: { className?: string }) {
  const rating = useGoogleRating();
  const source = googleRatingSourceLabel(rating);
  const label = rating ? `VVE Clean is rated ${rating.value.toFixed(1)} out of 5 from ${rating.count} Google reviews. ${source}. Read our Google reviews (opens in a new tab)` : 'Read our reviews on Google (opens in a new tab)';
  return <a href={GOOGLE_PROFILE_LINK} target="_blank" rel="noopener noreferrer" aria-label={label}
    className={`inline-flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 min-h-[44px] shadow-sm hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-600 ${className}`}>
    <GoogleIcon size={22} />
    <span className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5">
        {rating && <><span className="text-sm font-bold text-navy-950">{rating.value.toFixed(1)}</span><Star size={15} className="fill-amber-400 text-amber-400" aria-hidden="true" /></>}
        <span className="text-xs font-semibold text-slate-700">{rating ? `Google · ${rating.count} reviews` : 'Google Reviews'}</span>
      </span>
      {rating && <span className="text-xs text-slate-600">{source}</span>}
    </span>
  </a>;
}
