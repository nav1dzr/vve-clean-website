import { GoogleIcon } from '../Reviews';
import { getReviewsByName } from '../../data/reviews';

// Exactly two of the approved review records (src/data/reviews.ts) shown on a
// local area page, under a neutral heading — never implying a review came
// from the page's own area unless its stored `location` already says so, and
// never adding star ratings that were not read off the Google profile (see
// src/data/googleRating.ts).
export default function LocalReviewCards({ names }: { names: [string, string] }) {
  const reviews = getReviewsByName(names);
  if (reviews.length !== 2) return null;

  return (
    <section className="py-16 px-4 bg-white border-y border-silver-200" aria-label="Recent customer feedback">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
            Recent feedback from real customers
          </h2>
          <p className="text-slate-500 text-sm mt-3">
            Real reviews from real jobs, shown with their real location and service — see all of our{' '}
            <a href="/#reviews" className="text-royal-600 hover:underline">Google reviews</a>.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {reviews.map((r) => (
            <div
              key={r.name}
              className="bg-white border border-silver-200 rounded-2xl p-6 flex flex-col shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span />
                <GoogleIcon size={17} />
              </div>

              <p className="text-navy-800 text-sm leading-relaxed flex-1 mb-5">"{r.text}"</p>

              <div className="border-t border-silver-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
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
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full border bg-royal-50 text-royal-600 border-royal-100">
                  {r.service}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
