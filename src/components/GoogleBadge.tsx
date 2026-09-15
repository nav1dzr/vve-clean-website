import { Star } from 'lucide-react';
import { GOOGLE_PROFILE_LINK, GoogleIcon } from './GoogleBrand';
import { useGoogleRating } from '../hooks/useGoogleRating';
import { googleRatingSourceLabel } from '../lib/googleRatingDisplay';

type GoogleBadgeProps = { className?: string; variant?: 'default' | 'compact' };

export default function GoogleBadge({ className = '', variant = 'default' }: GoogleBadgeProps) {
  const rating = useGoogleRating();
  const source = googleRatingSourceLabel(rating);
  const compact = variant === 'compact';
  const label = rating ? `VVE Clean is rated ${rating.value.toFixed(1)} out of 5 from ${rating.count} Google reviews. ${source}. Read our Google reviews (opens in a new tab)` : 'Read our reviews on Google (opens in a new tab)';
  return <a href={GOOGLE_PROFILE_LINK} target="_blank" rel="noopener noreferrer" aria-label={label}
    className={`inline-flex w-[18rem] max-w-full items-center gap-2.5 border border-slate-200 bg-white min-h-[44px] shadow-sm hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 ${compact ? 'rounded-xl px-3 py-2' : 'rounded-2xl px-4 py-2.5'} ${className}`}>
    <span className="shrink-0"><GoogleIcon size={compact ? 18 : 22} /></span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5">
        {rating && <><span className="text-sm font-bold tabular-nums text-navy-950">{rating.value.toFixed(1)}</span><Star size={15} className="shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" /></>}
        <span className="text-xs font-semibold text-slate-700">
          {rating ? <><span translate="no" className="whitespace-nowrap font-normal not-italic tracking-normal text-[#5e5e5e]">Google Maps</span> · <span className="tabular-nums">{rating.count}</span> reviews</> : 'Google Reviews'}
        </span>
      </span>
      {rating && <span className="text-xs text-slate-600">{source}</span>}
    </span>
  </a>;
}
