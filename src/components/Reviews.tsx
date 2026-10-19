import { Star } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import GoogleBadge from './GoogleBadge';
import { REVIEWS } from '../data/reviews';

import { GOOGLE_PROFILE_LINK, GOOGLE_REVIEW_LINK, GoogleIcon } from './GoogleBrand';
export { GOOGLE_PROFILE_LINK, GoogleIcon } from './GoogleBrand';

// Three strong reviews, one per service line, shown near the quote decision
// (this section sits directly below the calculator) — the full set is one
// click away via "Read our Google reviews" below.
//
// The Review type and REVIEWS array live in ../data/reviews so area pages can
// filter them by location without duplicating this content.

export default function Reviews() {
  const { ref, visible } = useReveal();

  return (
    <section id="reviews" ref={ref} className="py-20 bg-white border-y border-silver-200 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="mb-6"><GoogleBadge /></div>

          <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3 text-success">
            Read our reviews on Google
          </p>

          <h2
            className="font-display font-bold text-navy-900 mb-4"
            style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', lineHeight: 1.15 }}
          >
            Rated by London customers on Google
          </h2>

          <p className="text-silver-600 text-base max-w-xl mx-auto">
            Real reviews from real jobs — end of tenancy, carpet cleaning, and more across East and North London.
          </p>
        </div>

        {/* Cards — flex-wrap so last row centres naturally */}
        <div className="flex flex-wrap justify-center gap-5 mb-10">
          {REVIEWS.map((r, i) => (
            <div
              key={i}
              className={`bg-white border border-silver-200 rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-royal-400 transition-all duration-300 w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.33%-14px)] ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Per-review stars, only when that review's own rating is
                  recorded above, and the Google G that sources the quote. */}
              <div className="flex items-center justify-between mb-3">
                {r.rating ? (
                  <div className="flex gap-0.5" aria-label={`Rated ${r.rating} out of 5`}>
                    {Array.from({ length: 5 }, (_, k) => (
                      <Star
                        key={k}
                        size={14}
                        className={k < r.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-silver-300'}
                      />
                    ))}
                  </div>
                ) : (
                  // No stars rather than assumed stars. Two of these cards
                  // already carry "Google review" in the footer date line, so a
                  // placeholder label here would only repeat it.
                  <span />
                )}
                <GoogleIcon size={17} />
              </div>

              {/* Review text */}
              <p className="text-navy-800 text-sm leading-relaxed flex-1 mb-5">
                "{r.text}"
              </p>

              {/* Footer */}
              <div className="border-t border-silver-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-navy-900 text-sm font-semibold">{r.name}</span>
                      {r.isLocalGuide && (
                        <span className="text-[10px] text-silver-600 bg-silver-100 border border-silver-300 px-1.5 py-0.5 rounded-full font-medium">
                          Local Guide
                        </span>
                      )}
                    </div>
                    <div className="text-silver-500 text-[11px] mt-0.5">
                      {r.location} · {r.date}
                    </div>
                  </div>
                </div>

                {/* Service chip */}
                <span
                  className={`text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full border ${
                    r.service === 'Carpet Cleaning'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : r.service === 'Sofa Cleaning'
                      ? 'bg-silver-100 text-silver-700 border-silver-300'
                      : r.service === 'Carpet & Sofa'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-royal-50 text-royal-600 border-royal-100'
                  }`}
                >
                  {r.service}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <a
            href={GOOGLE_PROFILE_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 border-2 border-navy-900 text-navy-900 font-bold px-7 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:bg-navy-900 hover:text-white text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            <GoogleIcon size={17} />
            Read our Google reviews
          </a>
          <a
            href={GOOGLE_REVIEW_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-white bg-royal-500 hover:bg-royal-600 px-7 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
          >
            <Star size={14} className="fill-white text-white" />
            Leave us a review
          </a>
        </div>

      </div>
    </section>
  );
}
