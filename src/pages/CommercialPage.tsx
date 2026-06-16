import { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_COMMERCIAL =
  'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20commercial%20site%20visit%20please.%20Address%3A%20';
const EMAIL = 'mailto:contact@vveclean.co.uk';

const WA_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
        <path
          d="M12 2C8.5 2 6 5 6 8c0 4 6 14 6 14s6-10 6-14c0-3-2.5-6-6-6zm0 9a3 3 0 110-6 3 3 0 010 6z"
          fill={dark ? '#7dd3fc' : '#0ea5e9'}
          opacity="0.4"
        />
        <circle cx="12" cy="8" r="2.5" fill={dark ? '#7dd3fc' : '#0ea5e9'} />
      </svg>
      <span className={`text-xs font-semibold tracking-[0.2em] uppercase ${dark ? 'text-sky-300' : 'text-sky-600'}`}>{children}</span>
    </div>
  );
}

function useRevealLocal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) { setVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Section: Who we clean for ────────────────────────────────────────────────

const WHO_CARDS = [
  {
    icon: '🏢',
    title: 'Offices & studios',
    body: 'Daily and weekly contracts, with out-of-hours visits so we never disturb your team. The same cleaner every time — they learn your site.',
  },
  {
    icon: '☕',
    title: 'Shops, cafés & restaurants',
    body: 'Front-of-house presentation cleans before you open: floors, glass, washrooms. Priced per visit, invoiced monthly.',
  },
  {
    icon: '🏬',
    title: 'Communal areas — blocks & landlords',
    body: 'Hallways, stairwells, lifts and bin stores on a weekly or fortnightly schedule. One invoice for the whole block.',
  },
  {
    icon: '🔑',
    title: 'End-of-lease commercial',
    body: 'Full handover cleans for offices and retail units, including carpets, windows and deep sanitisation, ready to re-let.',
  },
];

// ─── Section: Included checklist ──────────────────────────────────────────────

const INCLUDED = [
  'Same cleaner(s) on every visit — they learn your site',
  'Out-of-hours & keyholding available',
  'All equipment and products supplied',
  'RAMS, method statements & insurance certificates on request',
  'Monthly invoicing, 14-day payment terms',
  'No long lock-ins — 30 days\u2019 notice, that\u2019s it',
];

// ─── Section: Rates ───────────────────────────────────────────────────────────

const RATES = [
  { label: 'Office cleaning', price: 'from £20/hour' },
  { label: 'Communal areas, small block', price: 'from £70/month' },
  { label: 'Communal areas, large block', price: 'from £140/month' },
  { label: 'Shop/café presentation clean', price: 'from £35/visit' },
  { label: 'End-of-lease commercial clean', price: 'from £249 fixed' },
];

// ─── Section: How it works ────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'Send the address',
    body: 'WhatsApp or call us with the address. We visit within 48 hours at a time that suits you.',
  },
  {
    num: '02',
    title: 'Fixed written quote',
    body: 'You receive an itemised, fixed quote the same day — no obligation, no surprises.',
  },
  {
    num: '03',
    title: 'We start',
    body: 'Same team every visit, monthly invoice, 14-day payment terms. Simple as that.',
  },
];

// ─── Section: FAQ ─────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Do you have insurance and RAMS?',
    a: 'Yes — £5m public liability as standard. All staff are DBS-checked. We supply RAMS, method statements and insurance certificates before any contract starts, at no extra cost.',
  },
  {
    q: 'Can you clean outside opening hours?',
    a: 'Yes. Early mornings, evenings and weekends are all available. Keyholding and alarm management can be arranged for regular clients.',
  },
  {
    q: 'How does billing work?',
    a: 'One monthly invoice, 14-day payment terms. No deposits are required for contract clients.',
  },
  {
    q: 'Is there a minimum contract length?',
    a: 'No lock-ins. You can cancel with 30 days\u2019 notice. We keep clients by doing a good job, not by trapping them in contracts.',
  },
];

// ─── JSON-LD schema ───────────────────────────────────────────────────────────

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Service',
      name: 'Commercial cleaning',
      description:
        'Contract cleaning for offices, shops, cafés and retail units across East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean' },
      areaServed: [
        'E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12','E13','E14','E15','E16','E17',
        'N1','N2','N3','N4','N5','N6','N7','N8','N9','N10','N11','N12','N13','N14','N15','N16',
      ],
    },
    {
      '@type': 'Service',
      name: 'Communal area cleaning',
      description:
        'Weekly and fortnightly cleaning of communal hallways, stairwells, lifts and bin stores for residential blocks and landlords in East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean' },
      areaServed: [
        'E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12','E13','E14','E15','E16','E17',
        'N1','N2','N3','N4','N5','N6','N7','N8','N9','N10','N11','N12','N13','N14','N15','N16',
      ],
    },
  ],
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommercialPage() {
  const heroReveal = useRevealLocal();
  const whoReveal = useRevealLocal();
  const includedReveal = useRevealLocal();
  const ratesReveal = useRevealLocal();
  const stepsReveal = useRevealLocal();
  const landlordReveal = useRevealLocal();
  const faqReveal = useRevealLocal();
  const finalReveal = useRevealLocal();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA }} />

      <div className="min-h-screen bg-[#fafbfd] pb-[56px] lg:pb-0">
        <Navbar />

        {/* ── 1. HERO ── */}
        <section className="navy-gradient pt-28 pb-20 px-4">
          <div
            ref={heroReveal.ref}
            className={`max-w-4xl mx-auto text-center transition-all duration-700 ${heroReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <Eyebrow dark>Commercial &amp; Communal Cleaning</Eyebrow>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5">
              Commercial cleaning that<br className="hidden sm:block" />
              <span className="text-gradient-metallic"> shows up. Every time.</span>
            </h1>
            <p className="text-silver-300 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              Offices, shops, cafés and the communal areas of residential blocks across East &amp; North London.
              Free site visit within 48 hours, fixed written quote the same day, invoiced monthly.
            </p>

            {/* Trust row */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-10 text-silver-400 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="text-sky-400 font-bold">✓</span> £5m public liability insured
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-sky-400 font-bold">✓</span> DBS-checked staff
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-sky-400 font-bold">✓</span> RAMS &amp; method statements available
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WA_COMMERCIAL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base w-full sm:w-auto justify-center"
              >
                {WA_SVG}
                Book a free site visit
              </a>
              <a
                href={EMAIL}
                className="inline-flex items-center gap-2 border-2 border-white/40 hover:border-white text-white font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 hover:bg-white/10 text-base w-full sm:w-auto justify-center"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                Email us
              </a>
            </div>
          </div>
        </section>

        {/* ── 2. WHO WE CLEAN FOR ── */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <div
            ref={whoReveal.ref}
            className={`transition-all duration-700 ${whoReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-12">
              <Eyebrow>Who we clean for</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
                One team for every commercial space
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {WHO_CARDS.map((card, i) => (
                <div
                  key={card.title}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <span className="text-3xl mb-4 block" aria-hidden="true">{card.icon}</span>
                  <h3 className="font-display font-bold text-navy-900 text-lg leading-snug mb-2">{card.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. NAVY BAND — WHAT'S INCLUDED ── */}
        <section className="bg-navy-900 py-16 px-4">
          <div
            ref={includedReveal.ref}
            className={`max-w-4xl mx-auto transition-all duration-700 ${includedReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-10">
              <Eyebrow>Every contract</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
                What's included in every contract
              </h2>
            </div>
            <ul className="grid sm:grid-cols-2 gap-x-12 gap-y-4">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-silver-200 text-sm leading-relaxed">
                  <span className="text-[#F6B62B] font-bold text-base mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 4. GUIDE RATES (ticket-styled) ── */}
        <section className="max-w-3xl mx-auto px-4 py-20">
          <div
            ref={ratesReveal.ref}
            className={`transition-all duration-700 ${ratesReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-10">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
                Guide rates — your fixed quote follows the free site visit
              </h2>
            </div>

            {/* Price ticket */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              {/* Header strip */}
              <div className="bg-navy-900 px-6 py-4 flex items-center justify-between gap-3">
                <p className="font-mono text-silver-400 text-xs tracking-widest uppercase">VVE Clean · Commercial Services</p>
                <div
                  aria-hidden="true"
                  className="flex-shrink-0 bg-navy-800 text-white font-mono text-[9px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded border-2 border-navy-700 rotate-[-6deg] select-none opacity-80"
                >
                  FIXED QUOTE · NO SURPRISES
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-dashed divide-slate-200">
                {RATES.map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-6 py-4 gap-4">
                    <span className="text-slate-700 text-sm">{row.label}</span>
                    <span className="font-mono text-navy-900 font-bold text-sm whitespace-nowrap tabular-nums">
                      {row.price}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footnote */}
              <div className="border-t border-dashed border-slate-200 px-6 py-4 bg-slate-50">
                <p className="text-slate-500 text-xs leading-relaxed">
                  Rates depend on size, frequency and access. Every quote is fixed in writing before we start — no hourly surprises.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. HOW IT WORKS ── */}
        <section className="bg-[#f0f7ff] py-20 px-4">
          <div
            ref={stepsReveal.ref}
            className={`max-w-4xl mx-auto transition-all duration-700 ${stepsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-12">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
                Three steps to a spotless site
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="bg-white border border-slate-200/80 rounded-2xl p-7 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 text-center"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="font-mono text-sky-500 text-3xl font-bold mb-3">{step.num}</div>
                  <h3 className="font-display font-bold text-navy-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. WHY LANDLORDS & AGENTS USE US ── */}
        <section className="max-w-4xl mx-auto px-4 py-20">
          <div
            ref={landlordReveal.ref}
            className={`bg-white border border-slate-200/80 rounded-2xl p-8 md:p-10 shadow-sm transition-all duration-700 ${landlordReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <Eyebrow>For landlords &amp; agents</Eyebrow>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mb-4 leading-tight">
              Why landlords &amp; agents use us
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              We already clean end-of-tenancy properties to a 67-point agency checklist across E1–E17 and N1–N16. Agents who use us for communal areas get{' '}
              <strong className="text-navy-900">priority booking for their void-property cleans</strong> — one supplier, one invoice, one phone number that answers.
            </p>
          </div>
        </section>

        {/* ── 7. FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 pb-20">
          <div
            ref={faqReveal.ref}
            className={`transition-all duration-700 ${faqReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-10">
              <Eyebrow>FAQs</Eyebrow>
              <h2 className="font-display text-3xl font-bold text-navy-900">Common questions</h2>
            </div>
            <ul className="faq-list">
              {FAQS.map((faq) => (
                <li key={faq.q} className="faq-item">
                  <details>
                    <summary className="faq-summary">
                      <span className="faq-question">{faq.q}</span>
                      <span className="faq-icon" aria-hidden="true">+</span>
                    </summary>
                    <div className="faq-answer"><p>{faq.a}</p></div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 8. FINAL CTA BAND ── */}
        <section
          ref={finalReveal.ref}
          className={`navy-gradient py-20 px-4 transition-all duration-700 ${finalReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="max-w-2xl mx-auto text-center">
            <Eyebrow dark>Get started</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              Get your fixed quote this week.
            </h2>
            <p className="text-silver-300 text-base mb-10 leading-relaxed">
              We visit within 48 hours and deliver a written quote the same day. No obligation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WA_COMMERCIAL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-base w-full sm:w-auto justify-center"
              >
                {WA_SVG}
                WhatsApp us your address
              </a>
              <a
                href={EMAIL}
                className="inline-flex items-center gap-2 border-2 border-white/40 hover:border-white text-white font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 hover:bg-white/10 text-base w-full sm:w-auto justify-center"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                Email us
              </a>
            </div>
          </div>
        </section>

        <Footer />
      </div>
      <MobileStickyFooter />
    </>
  );
}
