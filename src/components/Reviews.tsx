import { Star } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const GOOGLE_REVIEW_LINK  = 'https://g.page/r/CYDRQCaICK7vEAE/review';
const GOOGLE_PROFILE_LINK = 'https://share.google/tZEyXUs0J0SxXZlDi';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const REVIEWS = [
  {
    name: 'Panos',
    initial: 'P',
    color: '#d81b60',
    location: 'Watford',
    service: 'End of Tenancy',
    date: 'June 2026',
    isLocalGuide: false,
    text: 'Great price, Great job. Job was completed to a high standard and very professional. Prompt arrival. Highly recommend for any cleaning needs.',
  },
  {
    name: 'Hannah M.',
    initial: 'H',
    color: '#5d4037',
    location: 'Islington, N1',
    service: 'End of Tenancy',
    date: 'June 2026',
    isLocalGuide: true,
    text: 'Amazing job for my end of tenancy clean — the carpets looked brand new and they even included the oven cleaning for free. Very professional and thorough from start to finish.',
  },
  {
    name: 'Marcin P.',
    initial: 'M',
    color: '#1a237e',
    location: 'East London',
    service: 'Sofa Cleaning',
    date: 'June 2026',
    isLocalGuide: true,
    text: 'I am happy with the sofa cleaning service. The guys were eager, energetic, and worked efficiently throughout the job. Great results and a very professional team.',
  },
  {
    name: 'Ahmad B.',
    initial: 'A',
    color: '#e53935',
    location: 'Stratford, E15',
    service: 'Carpet Cleaning',
    date: 'June 2026',
    isLocalGuide: false,
    text: 'Really happy with the service. The team did a brilliant job on my end of tenancy carpet clean. The carpets looked fresh and like new again. Friendly, professional, and great results. Would definitely recommend.',
  },
  {
    name: 'Milad S.',
    initial: 'MS',
    color: '#0369a1',
    location: 'East London',
    service: 'End of Tenancy',
    date: 'May 2026',
    isLocalGuide: false,
    text: "Great job, really nice doing business with you — I'm super happy. The place was absolutely spotless when they finished. Professional team and great communication throughout.",
  },
];

export default function Reviews() {
  const { ref, visible } = useReveal();

  return (
    <section id="reviews" ref={ref} className="py-20 bg-white border-y border-silver-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Google aggregate badge */}
          <div className="inline-flex items-center gap-3 bg-white border border-silver-200 rounded-2xl px-5 py-3 shadow-sm mb-6">
            <GoogleIcon size={22} />
            <div className="flex items-center gap-2">
              <span className="font-bold text-navy-900 text-base leading-none">5.0</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(k => (
                  <Star key={k} size={13} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
            </div>
            <div className="w-px h-5 bg-silver-200" />
            <span className="text-silver-600 text-sm font-medium">Google Reviews</span>
          </div>

          <p
            className="text-xs font-semibold tracking-[0.18em] uppercase mb-3"
            style={{ color: '#0E5E47' }}
          >
            ✦ Verified on Google
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
              {/* Stars + Google G */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(k => (
                    <Star key={k} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
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
            className="inline-flex items-center gap-2.5 border-2 border-navy-900 text-navy-900 font-bold px-7 py-3.5 rounded-full transition-all duration-300 hover:bg-navy-900 hover:text-white text-sm"
          >
            <GoogleIcon size={17} />
            Read our Google reviews
          </a>
          <a
            href={GOOGLE_REVIEW_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-bold text-navy-900 px-7 py-3.5 rounded-full transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 text-sm"
            style={{ background: 'linear-gradient(135deg, #d4a843 0%, #f0c85a 50%, #d4a843 100%)' }}
          >
            <Star size={14} className="fill-navy-900 text-navy-900" />
            Leave us a review
          </a>
        </div>

      </div>
    </section>
  );
}
