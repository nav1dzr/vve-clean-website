import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-start sm:items-center overflow-hidden pb-24 sm:pb-0">

      {/* Background image — full bleed */}
      <div className="absolute inset-0">
        {/* LCP element — eager-loaded (no loading="lazy") with fetchPriority
            "high" and explicit dimensions so it doesn't compete with
            below-fold images and doesn't cause layout shift. */}
        <img
          src="/photo_2026-06-02_16-48-38.jpg"
          alt="Professional end-of-tenancy cleaning result — spotless kitchen"
          width={1536}
          height={1024}
          // @ts-expect-error — fetchpriority is a valid HTML attribute; this
          // React/react-dom version doesn't type it yet, but passes lowercase
          // attribute names through to the DOM untouched.
          fetchpriority="high"
          decoding="async"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Left dark navy overlay — gradient fading right */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 via-50% to-navy-950/10 lg:to-transparent" />
      {/* Extra top gradient for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/60 via-transparent to-navy-950/40" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-[82px] sm:pt-[90px] lg:pt-[80px]">
        <div className="max-w-2xl">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-1.5 mb-6" style={{ animationDelay: '0.1s' }}>
            <span className="w-2 h-2 rounded-full bg-royal-400 animate-pulse" />
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">
              Independent &amp; Owner-Operated — No Call Centres, No Random Cleaners
            </span>
          </div>

          {/* H1 — Bricolage Grotesque 800 */}
          <h1
            className="font-hero font-extrabold text-[1.95rem] sm:text-4xl lg:text-[2.6rem] xl:text-5xl text-white leading-[1.08] mb-6 animate-fade-in-up"
            style={{ animationDelay: '0.2s', opacity: 0 }}
          >
            Get your full deposit back — or we{' '}
            <span className="text-sky-300">re-clean</span>
            {' '}free within{' '}
            <span className="text-royal-300">48 hours.</span>
          </h1>

          {/* Supporting text */}
          <p
            className="text-silver-300 text-lg leading-relaxed mb-5 max-w-lg animate-fade-in-up"
            style={{ animationDelay: '0.45s', opacity: 0 }}
          >
            End of tenancy and deep cleaning across East &amp; North London by DBS-checked, fully insured cleaners. See your exact price in 3 taps — no forms, no waiting for a callback.
          </p>

          {/* Benefit checklist */}
          <ul
            className="space-y-2 mb-7 animate-fade-in-up"
            style={{ animationDelay: '0.52s', opacity: 0 }}
          >
            {[
              "Our 67-point checklist mirrors the one your letting agent's clerk uses",
              'Oven clean included free with every end of tenancy (most companies charge up to £45) — booked on its own, £35',
              "Fixed prices. £30 deposit books your slot — balance only after you've checked the work",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-white text-sm font-medium leading-snug">{text}</span>
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

        </div>
      </div>


    </section>
  );
}
