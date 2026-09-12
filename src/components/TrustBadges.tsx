import { useGoogleRating } from '../hooks/useGoogleRating';
import { Shield, CheckCircle, Star, Lock } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import { GOOGLE_PROFILE_LINK } from './Reviews';
import { googleRatingSourceLabel } from '../lib/googleRatingDisplay';

// Exactly four verified items per the design spec — this is the site's one
// trust row; other sections should not repeat these same claims.
const badges = [
  { icon: Shield,      label: '£5m Public Liability',  sub: 'Fully insured' },
  { icon: CheckCircle, label: 'Direct Contact',         sub: 'Speak with VVE Clean' },
  // sub was "5.0 average rating". A fourth unsubstantiated copy of the rating
  // claim — see src/data/googleRating.ts. The reviews themselves are real and
  // public, which is what this badge now says.
  { icon: Star,        label: 'Real Google Reviews',    sub: 'From our public profile' },
  { icon: Lock,        label: 'Secure Stripe Payment',  sub: 'Card details handled by Stripe' },
];

export default function TrustBadges() {
  const { ref, visible } = useReveal();
  const rating = useGoogleRating();

  return (
    <section ref={ref} className="bg-surface py-10 border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {badges.map((badge, i) => (
            <div
              key={i}
              className={`min-w-0 flex flex-col items-center text-center bg-white border border-sky-200 rounded-xl p-4 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md hover:border-sky-400 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <badge.icon className="text-royal-500 mb-2" size={22} aria-hidden="true" />
              <div className="text-navy-800 text-xs font-semibold mb-0.5">{badge.label}</div>
              {badge.icon === Star ? <>
                <p className="text-slate-600 text-xs leading-relaxed">{rating ? `${rating.value.toFixed(1)} from ${rating.count} Google reviews` : badge.sub}</p>
                {rating && <p className="mt-1 text-xs leading-relaxed text-slate-600">{googleRatingSourceLabel(rating)}</p>}
                <a href={GOOGLE_PROFILE_LINK} target="_blank" rel="noopener noreferrer"
                  aria-label="Read VVE Clean reviews on Google (opens in a new tab)"
                  className="mt-1 inline-flex min-h-[44px] max-w-full items-center justify-center text-xs font-semibold leading-relaxed text-royal-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600">
                  Read on Google
                </a>
              </> : <div className="text-slate-500 text-[10px]">{badge.sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
