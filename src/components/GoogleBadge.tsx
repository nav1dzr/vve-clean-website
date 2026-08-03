import { Star } from 'lucide-react';
import { GOOGLE_PROFILE_LINK, GoogleIcon } from './Reviews';
import {
  GOOGLE_RATING_ARIA_LABEL,
  GOOGLE_RATING_LABEL,
  VERIFIED_GOOGLE_RATING,
} from '../data/googleRating';

// Compact Google trust badge — shown directly below hero CTAs on the homepage
// and service landing pages.
//
// The numeric rating is driven by src/data/googleRating.ts, which is currently
// unverified, so no number is displayed and the accessible name makes no rating
// claim. It used to hardcode "5.0" here and announce "rated 5.0 out of 5 on
// Google" to screen readers, with nothing in the project substantiating either.
// Set VERIFIED_GOOGLE_RATING once the real figures are read off the live
// profile and the number returns here automatically.
export default function GoogleBadge({ className = '' }: { className?: string }) {
  return (
    <a
      href={GOOGLE_PROFILE_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={GOOGLE_RATING_ARIA_LABEL}
      className={`inline-flex items-center gap-2.5 bg-white rounded-full pl-3 pr-4 py-2 min-h-[44px] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-400 ${className}`}
    >
      <GoogleIcon size={18} />
      {/* Decorative only — aria-hidden, and it sits beside wording that makes
          no numeric claim. It is not the source of a rating. */}
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((k) => (
          <Star key={k} size={13} className="text-yellow-400 fill-yellow-400" />
        ))}
      </span>
      {VERIFIED_GOOGLE_RATING && (
        <span className="text-navy-900 text-sm font-bold leading-none">
          {VERIFIED_GOOGLE_RATING.value}
        </span>
      )}
      <span className="text-slate-500 text-xs font-semibold leading-none">
        {VERIFIED_GOOGLE_RATING ? 'on Google' : GOOGLE_RATING_LABEL}
      </span>
    </a>
  );
}
