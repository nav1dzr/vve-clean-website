import { ArrowRight, CheckCircle2 } from 'lucide-react';
import GoogleBadge from './GoogleBadge';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-start sm:items-center overflow-hidden pb-24 sm:pb-0">

      {/* Background image — full bleed */}
      <div className="absolute inset-0">
        {/* LCP element — eager-loaded (no loading="lazy") with fetchPriority
            "high" and explicit dimensions so it doesn't compete with
            below-fold images and doesn't cause layout shift. */}
        <picture className="block h-full w-full">
          <source type="image/avif" srcSet="/hero-cleaning-768.avif 768w, /hero-cleaning-1280.avif 1280w" sizes="100vw" />
          <source type="image/webp" srcSet="/hero-cleaning-768.webp 768w, /hero-cleaning-1280.webp 1280w" sizes="100vw" />
          <img
            src="/photo_2026-06-02_16-48-38.jpg"
            alt="VVE Clean technician working at a London property"
            width={1536}
            height={1024}
            // @ts-expect-error — fetchpriority is a valid HTML attribute; this
            // React/react-dom version doesn't type it yet, but passes lowercase
            // attribute names through to the DOM untouched.
            fetchpriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        </picture>
      </div>

      {/* Overlay — on mobile the copy spans the full width, so use a
          vertical navy wash that keeps the photo visible but readable;
          from sm up keep the left-to-right gradient so more of the image
          shows on larger screens. */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/85 via-navy-950/60 to-navy-950/45 sm:bg-gradient-to-r sm:from-navy-950 sm:via-navy-950/90 sm:via-50% sm:to-navy-950/10 lg:to-transparent" />
      {/* Extra top gradient for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/60 via-transparent to-navy-950/40" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-[82px] sm:pt-[90px] lg:pt-[80px]">
        <div className="max-w-2xl">

          {/* Badge — shortened to one line on mobile so it takes less
              vertical space; the full wording returns from sm up. */}
          <div className="inline-flex items-center gap-2 glass-card rounded-full px-3 py-1 sm:px-4 sm:py-1.5 mb-3 sm:mb-6" style={{ animationDelay: '0.1s' }}>
            <span className="w-2 h-2 rounded-full bg-royal-400 animate-pulse" />
            <span className="text-silver-200 text-[10px] sm:text-xs tracking-widest font-medium uppercase">
              <span>London cleaning &amp; property services</span>
            </span>
          </div>

          {/* H1 — Bricolage Grotesque 800. Two deliberate lines, so the break
              is forced rather than left to the container width. Scaled up from
              the previous headline: that one was a long sentence that had to
              wrap into several lines, this one is two short ones and can carry
              more weight in the same space. */}
          <h1
            className="font-hero font-extrabold text-[2rem] sm:text-5xl lg:text-[3.1rem] xl:text-6xl text-white leading-[1.12] sm:leading-[1.06] mb-3 sm:mb-6 animate-fade-in-up text-shadow-hero"
            style={{ animationDelay: '0.2s', opacity: 0 }}
          >
            Professional cleaning,
            <br />
            <span className="text-sky-300">without the runaround.</span>
          </h1>

          {/* Supporting text — one version at every breakpoint now: the copy
              names the full service range, which does not shorten usefully. */}
          <p
            className="text-silver-100 text-[15px] sm:text-lg leading-relaxed mb-4 sm:mb-5 max-w-xl animate-fade-in-up text-shadow-hero"
            style={{ animationDelay: '0.45s', opacity: 0 }}
          >
            Clear prices, professional equipment and a team you can contact directly for carpets,
            upholstery, end of tenancy, move-in and after-builders cleaning across East &amp; North London.
          </p>

          {/* Benefit checklist — company-wide credentials rather than
              service-specific detail, so each reads the same at every width. */}
          <ul
            className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-7 animate-fade-in-up"
            style={{ animationDelay: '0.52s', opacity: 0 }}
          >
            {[
              '£5m public liability insurance',
              'Published prices for standard services',
              '72-hour re-clean on Complete end of tenancy cleans',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-white text-[13px] sm:text-sm font-medium leading-snug">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-3 animate-fade-in-up"
            style={{ animationDelay: '0.6s', opacity: 0 }}
          >
            <a
              href="#quote"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[44px] bg-royal-500 hover:bg-royal-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 text-base w-full sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get my price
              <ArrowRight size={18} />
            </a>
            <a
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[44px] border-2 border-white/60 text-white font-semibold rounded-lg transition-all duration-300 hover:bg-white hover:text-navy-900 hover:border-white text-base w-full sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              See all prices
            </a>
          </div>

          {/* Google trust badge — directly below the CTAs */}
          <div
            className="mt-4 animate-fade-in-up"
            style={{ animationDelay: '0.7s', opacity: 0 }}
          >
            <GoogleBadge />
          </div>

        </div>
      </div>


    </section>
  );
}
