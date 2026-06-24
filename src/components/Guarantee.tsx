import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const COVERED = [
  'Missed areas from the original booked service',
  'Reported by landlord, letting agent, or inventory report',
  'Reported within 48 hours of our visit',
  'Supported by a report or photos',
];

const NOT_COVERED = [
  'Wear and tear or pre-existing damage',
  'Permanent stains, mould staining, or limescale/corrosion damage',
  'Old paint marks or structural discolouration',
  'Odours from hidden sources (e.g. subfloor, inside walls)',
  'Rubbish removal not included in the original booking',
  'Areas we could not access during the clean',
  'Mess or damage created after the clean',
];

const WA_BOOK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20book%20with%20confidence';

export default function Guarantee() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      id="guarantee"
      className="py-20 px-4"
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
            ✦ Our Guarantee
          </p>

          <h2
            className="font-display font-bold text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.9rem, 5vw, 2.75rem)' }}
          >
            48-Hour Re-clean Guarantee
          </h2>

          <p className="text-silver-300 text-base max-w-2xl mx-auto leading-relaxed">
            If your landlord, letting agent, or inventory report highlights a cleaning issue within
            48 hours of our visit, send us the report or photos and we'll return once to re-clean
            the missed areas — <span className="text-white font-semibold">free of charge</span>.
          </p>
        </div>

        {/* Two-column breakdown */}
        <div
          className={`grid md:grid-cols-2 gap-5 mb-10 transition-all duration-700 delay-150 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* What's covered */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={17} className="text-green-400 flex-shrink-0" />
              <h3 className="text-white font-semibold text-sm uppercase tracking-widest">What's covered</h3>
            </div>
            <ul className="space-y-2.5">
              {COVERED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-silver-300 text-sm leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What's not covered */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={17} className="text-silver-400 flex-shrink-0" />
              <h3 className="text-white font-semibold text-sm uppercase tracking-widest">Not covered</h3>
            </div>
            <ul className="space-y-2.5">
              {NOT_COVERED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <XCircle size={14} className="text-silver-500 flex-shrink-0 mt-0.5" />
                  <span className="text-silver-400 text-sm leading-snug">{item}</span>
                </li>
              ))}
            </ul>
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
          <p className="text-silver-500 text-xs mt-3">
            Questions? WhatsApp us before you book — we reply within minutes.
          </p>
        </div>

      </div>
    </section>
  );
}
