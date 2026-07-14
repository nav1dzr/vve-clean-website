import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Shield, Star } from 'lucide-react';
import QuoteCalculator, { type BookingSelection } from '../components/QuoteCalculator';
import { setLeafletAttribution } from '../lib/attribution';
import { DISCOUNT_MIN_NOTE } from '../data/carpetPricing';

const WA_NUMBER = '447845451111';

const LEAFLET_WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%20scanned%20your%20leaflet%20and%20have%20a%20question.';

function LeafletHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.08]"
      style={{ background: 'rgba(249,249,245,0.96)', backdropFilter: 'blur(10px)' }}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Logo → homepage */}
        <a href="/" className="flex flex-col leading-none gap-0.5 flex-shrink-0">
          <span className="font-display font-bold text-2xl tracking-widest" style={{ color: '#1c1917' }}>
            V<span style={{ color: '#b8960c' }}>V</span>E
          </span>
          <span className="flex items-center gap-1">
            <span className="block h-px w-3" style={{ background: '#b8960c' }} />
            <span className="text-[8px] tracking-[0.25em] font-semibold uppercase" style={{ color: '#1c1917' }}>CLEAN</span>
            <span className="block h-px w-3" style={{ background: '#b8960c' }} />
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 flex-1 justify-center">
          <a href="/#services" className="text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors">Services</a>
          <a href="/pricing"   className="text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors">Prices</a>
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile: Need help */}
          <a href={LEAFLET_WA} target="_blank" rel="noopener noreferrer"
            className="md:hidden flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white font-semibold text-xs px-3 py-2 rounded-full transition-colors min-h-[36px]"
            aria-label="Need help? Chat on WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Help
          </a>
          {/* Get a price → calculator on this page */}
          <a href="#quote"
            className="flex items-center gap-1.5 bg-royal-500 hover:bg-royal-600 text-white font-semibold text-sm px-4 py-2 rounded-full transition-colors min-h-[36px]">
            Get a price
          </a>
        </div>
      </div>
    </header>
  );
}

export default function LeafletPage() {
  const navigate = useNavigate();

  useEffect(() => {
    setLeafletAttribution();
  }, []);

  const handleBook = (sel: BookingSelection) => {
    sessionStorage.setItem('vve_booking', JSON.stringify(sel));
    navigate('/booking');
  };

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    'Hi VVE Clean, I scanned your leaflet and would like to book a carpet or upholstery clean with the 20% off offer. My postcode is: '
  )}`;

  return (
    <div className="min-h-screen" style={{ background: '#f9f9f5' }}>
      <LeafletHeader />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section style={{ background: '#020b24' }} className="px-4 py-14 text-center">
        <div className="max-w-2xl mx-auto">

          {/* Offer badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 font-bold text-xs tracking-widest uppercase"
            style={{ background: '#b8960c', color: '#020b24' }}>
            <Star size={12} fill="currentColor" />
            Local customer offer
            <Star size={12} fill="currentColor" />
          </div>

          <h1 className="font-display font-bold text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', lineHeight: 1.15 }}>
            You've unlocked your<br />local customer offer
          </h1>

          <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Book your first carpet, sofa or upholstery clean<br className="hidden sm:block" />
            and get <span className="text-white font-bold">20% off</span>.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <a href="#quote"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-bold text-base transition-all hover:opacity-90"
              style={{ background: '#0ea5e9', color: '#fff' }}>
              Get My Quote →
            </a>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-bold text-base transition-all hover:opacity-90"
              style={{ background: '#25D366', color: '#fff' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Send Photos on WhatsApp
            </a>
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {['Fully insured', 'Professional extraction equipment', 'Clear quote before booking'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={13} style={{ color: '#22C55E' }} /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Offer box ───────────────────────────────────────────────── */}
      <section className="px-4 py-8">
        <div className="max-w-xl mx-auto">
          <div className="rounded-2xl border-2 p-6 text-center"
            style={{ background: '#fffbeb', borderColor: '#b8960c' }}>
            <div className="text-3xl font-display font-bold mb-1" style={{ color: '#92700a' }}>
              20% OFF YOUR FIRST CLEAN
            </div>
            <p className="text-sm font-semibold mb-3" style={{ color: '#78610d' }}>
              Your leaflet offer is automatically applied. No code needed.
            </p>
            <p className="text-xs font-semibold mb-3" style={{ color: '#92700a' }}>
              {DISCOUNT_MIN_NOTE}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: '#a07a15' }}>
              Available to new residential customers only. Applies to carpet, sofa and upholstery cleaning bookings.
              One offer per household. Cannot be combined with another offer. Parking, congestion charge and extra
              access charges are not discounted. Final price depends on size, material, condition and access.
              If your discounted total falls below the minimum booking charge, the minimum charge applies instead
              of the discounted price.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust points ────────────────────────────────────────────── */}
      <section className="px-4 pb-6">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5 shadow-sm">
            <div className="text-[9px] font-bold tracking-widest uppercase mb-3" style={{ color: '#adb5bd' }}>
              What to expect
            </div>
            <div className="space-y-2.5">
              {[
                { icon: <Shield size={15} style={{ color: '#0ea5e9' }} />,   text: 'Fully insured — public liability cover on every job' },
                { icon: <CheckCircle2 size={15} style={{ color: '#22C55E' }} />, text: 'Professional truck-mounted or portable extraction equipment' },
                { icon: <CheckCircle2 size={15} style={{ color: '#22C55E' }} />, text: 'Clear written quote before any work starts' },
                { icon: <CheckCircle2 size={15} style={{ color: '#22C55E' }} />, text: '£30 deposit to submit your booking request — deducted from final bill' },
                { icon: <CheckCircle2 size={15} style={{ color: '#22C55E' }} />, text: 'Balance payable after the clean — not before' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5">{icon}</span>
                  <span className="text-sm text-navy-800">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Price example ───────────────────────────────────────────── */}
      <section className="px-4 pb-8">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5 shadow-sm">
            <div className="text-[9px] font-bold tracking-widest uppercase mb-3" style={{ color: '#adb5bd' }}>
              Example saving
            </div>
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'Standard price',         value: '£175',  muted: true },
                { label: 'Leaflet discount 20%',   value: '−£35',  green: true },
                { label: 'Total after discount',   value: '£140',  bold: true },
                { label: 'Deposit today',          value: '£30' },
                { label: 'Balance after clean',    value: '£110' },
              ].map(({ label, value, muted, green, bold }) => (
                <div key={label} className={`flex justify-between items-center ${bold ? 'border-t border-[#E3E7EE] pt-1.5 mt-1' : ''}`}>
                  <span className={muted ? 'text-silver-500' : green ? 'text-green-700 font-semibold' : bold ? 'text-navy-900 font-bold' : 'text-navy-800'}>
                    {label}
                  </span>
                  <span className={muted ? 'text-silver-500 line-through' : green ? 'text-green-700 font-bold' : bold ? 'text-navy-900 font-bold text-base' : 'text-navy-800 font-semibold'}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Quote calculator (reused, promoCode="LEAFLET20") ─────────── */}
      <div id="quote">
        <QuoteCalculator onBook={handleBook} promoCode="LEAFLET20" />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ background: '#020b24', borderTop: '1px solid rgba(255,255,255,0.05)' }}
        className="py-8 px-6">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-4 text-center">
          <div>
            <div className="font-display font-bold text-2xl tracking-widest text-white">
              V<span style={{ color: '#b8960c' }}>V</span>E
            </div>
            <div className="text-[9px] tracking-[0.25em] font-semibold uppercase mt-0.5"
              style={{ color: 'rgba(255,255,255,0.65)' }}>CLEAN</div>
          </div>
          <nav className="flex gap-4 flex-wrap justify-center">
            {[['/', 'Home'], ['/pricing', 'Pricing'], ['/commercial', 'Commercial'], ['/#contact', 'Contact']].map(([href, label]) => (
              <a key={href} href={href}
                className="text-xs transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}>
                {label}
              </a>
            ))}
          </nav>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            © 2026 VVE Clean Ltd. All rights reserved. Registered in England &amp; Wales.
          </p>
        </div>
      </footer>
    </div>
  );
}
