import { Shield, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { GUARANTEE_COVERED } from '../data/guarantee';

const WA_BOOK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20book%20with%20confidence';

export default function Guarantee() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      id="guarantee"
      className="py-20 px-4 scroll-mt-24"
      style={{ background: 'linear-gradient(160deg, #020b24 0%, #0a1e4a 100%)' }}
    >
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="flex justify-center mb-5">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20">
              <Shield className="text-amber-400" size={32} />
            </div>
          </div>

          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-400 mb-3">
            ✦ End of Tenancy Guarantee
          </p>

          {/* The heading names the service the guarantee belongs to. This
              section renders on the homepage, where a carpet or sofa customer
              scanning past an unscoped "72-Hour Re-clean Guarantee" would
              reasonably read it as sitewide. MASTER.md: the re-clean terms
              attach only to the applicable end of tenancy package or the
              selected tasks. */}
          <h2
            className="font-display font-bold text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.9rem, 5vw, 2.75rem)' }}
          >
            {EOT_GUARANTEE_HOURS}-Hour End of Tenancy Re-clean Guarantee
          </h2>

          <p className="text-silver-300 text-base max-w-2xl mx-auto leading-relaxed">
            If your landlord, letting agent, or inventory report highlights a cleaning issue within
            {' '}{EOT_GUARANTEE_HOURS} hours of our visit, send us the report or photos and we'll return once to re-clean
            the missed areas — <span className="text-white font-semibold">free of charge</span>. Full agency-ready
            coverage applies to our Complete end of tenancy package; Tailored cleans are covered for the tasks selected.
          </p>
        </div>

        {/* What qualifies — the four conditions, kept here because they are
            what a visitor needs to judge the promise. The full exclusion list
            lives on /end-of-tenancy-cleaning-london, the page the guarantee
            actually belongs to (§9: move detailed exclusions off the
            homepage). Both read from src/data/guarantee.ts, so they cannot
            drift apart. */}
        <div
          className={`mb-8 transition-all duration-700 delay-150 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="mx-auto max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold text-sm uppercase tracking-widest mb-4">
              What qualifies
            </h3>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {GUARANTEE_COVERED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-silver-300 text-sm leading-snug">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-silver-400 text-xs mt-5 leading-relaxed">
              Some things are not covered — including wear and tear, permanent stains and mess
              created after the clean.{' '}
              <Link
                to="/end-of-tenancy-cleaning-london#guarantee"
                className="text-silver-200 underline underline-offset-2 hover:no-underline"
              >
                See the full guarantee terms
              </Link>
              .
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          className={`text-center transition-all duration-700 delay-300 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <a
            href={WA_BOOK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 font-bold text-navy-900 px-8 py-4 rounded-full transition-all duration-300 hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5 text-sm"
            style={{ background: 'linear-gradient(135deg, #d4a843 0%, #f0c85a 50%, #d4a843 100%)' }}
          >
            <Shield size={16} className="flex-shrink-0" />
            Book with confidence
          </a>
          <p className="text-silver-300 text-xs mt-3">
            Questions? WhatsApp us before you book.
          </p>
        </div>

      </div>
    </section>
  );
}
