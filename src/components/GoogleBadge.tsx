import { Star } from 'lucide-react';
import { GOOGLE_PROFILE_LINK, GoogleIcon } from './Reviews';

// Compact, high-contrast Google trust badge — shown directly below hero CTAs
// on the homepage and service landing pages. No review count is displayed
// because no verified current count exists in the project.
export default function GoogleBadge({ className = '' }: { className?: string }) {
  return (
    <a
      href={GOOGLE_PROFILE_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="VVE Clean is rated 5.0 out of 5 on Google — read our Google reviews (opens in a new tab)"
      className={`inline-flex items-center gap-2.5 bg-white rounded-full pl-3 pr-4 py-2 min-h-[44px] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-400 ${className}`}
    >
      <GoogleIcon size={18} />
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((k) => (
          <Star key={k} size={13} className="text-yellow-400 fill-yellow-400" />
        ))}
      </span>
      <span className="text-navy-900 text-sm font-bold leading-none">5.0</span>
      <span className="text-slate-500 text-xs font-semibold leading-none">on Google</span>
    </a>
  );
}
