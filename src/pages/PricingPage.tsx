import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_BASE = 'https://wa.me/447845451111';
const WA_SIMPLE = `${WA_BASE}?text=${encodeURIComponent("Hi VVE Clean! I'd like to book a clean.")}`;
const WA_PHOTO  = `${WA_BASE}?text=${encodeURIComponent("Hi VVE Clean! I'd like to send a photo for a quote.")}`;

const WA_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-[56px] lg:pb-0">
      <Navbar />

      {/* ── Hero ── */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Transparent Pricing</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Clear Prices,<br />
            <span className="text-gradient-metallic">Zero Surprises</span>
          </h1>
          <p className="text-silver-300 text-lg max-w-xl mx-auto">
            Every price listed is the price you pay. Pick your service, see the total, book in seconds.
          </p>
        </div>
      </div>

      {/* ── 1. VACANT PROPERTY CLEANS TABLE ── */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-2">Vacant Property Cleans</h2>
          <p className="text-silver-600">Fixed prices for end-of-tenancy, move-in, and post-build cleans.</p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-silver-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-950 text-white">
                <th className="text-left px-6 py-4 font-semibold text-silver-300 uppercase tracking-widest text-xs w-36">Property size</th>
                <th className="px-6 py-4 font-semibold text-silver-300 uppercase tracking-widest text-xs">
                  <div className="flex flex-col items-center gap-1">
                    <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase">Most Booked</span>
                    End of Tenancy
                    <span className="text-green-400 text-[10px] font-normal normal-case tracking-normal">Oven clean FREE — most companies charge up to £45</span>
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold text-silver-300 uppercase tracking-widest text-xs">Move-in Deep Clean</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Studio', 159, 139],
                ['1 Bed',  199, 169],
                ['2 Bed',  249, 219],
                ['3 Bed',  329, 269],
                ['4+ Bed', 419, 329],
              ].map(([size, eot, movein], i) => (
                <tr key={String(size)} className={i % 2 === 0 ? 'bg-white' : 'bg-silver-100/60'}>
                  <td className="px-6 py-4 font-bold text-navy-900">{size}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-display font-bold text-xl text-royal-600">£{eot}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-navy-800">£{movein}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-4">
          {[
            ['Studio', 159, 139],
            ['1 Bed',  199, 169],
            ['2 Bed',  249, 219],
            ['3 Bed',  329, 269],
            ['4+ Bed', 419, 329],
          ].map(([size, eot, movein]) => (
            <div key={String(size)} className="bg-white rounded-2xl border border-silver-200 p-5 shadow-sm">
              <div className="font-bold text-navy-900 text-base mb-3">{size}</div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="bg-royal-50 rounded-xl p-3">
                  <div className="text-royal-600 font-bold text-lg">£{eot}</div>
                  <div className="text-silver-600 mt-0.5">End of Tenancy</div>
                  <div className="text-green-600 text-[9px] font-semibold mt-0.5">Oven FREE</div>
                </div>
                <div className="bg-silver-100 rounded-xl p-3">
                  <div className="text-navy-900 font-bold text-lg">£{movein}</div>
                  <div className="text-silver-600 mt-0.5">Move-in</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="text-silver-500 text-xs mt-4 text-center leading-relaxed">
          Each bathroom/WC beyond the first: <strong className="text-navy-700">+£20</strong> end of tenancy &nbsp;·&nbsp; <strong className="text-navy-700">+£18</strong> move-in
        </p>

        {/* After Builders callout */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <div className="font-display text-lg font-bold text-navy-900 mb-1">After Builders Clean</div>
            <div className="text-amber-700 text-sm font-semibold mb-2">From £199 — final price confirmed after a quick photo</div>
            <p className="text-silver-600 text-sm leading-relaxed max-w-lg">
              The extent of after-builders work varies job to job — fine dust, paint specks, sticker residue and debris. Send us a photo and we'll confirm your price within the hour.
            </p>
          </div>
          <a href={WA_PHOTO} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 bg-[#22C55E] hover:opacity-90 text-white font-bold px-5 py-3 rounded-xl transition-all duration-200 text-sm whitespace-nowrap">
            {WA_SVG}
            WhatsApp a photo
          </a>
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-8">
          <a href={WA_SIMPLE} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-[#22C55E] hover:opacity-90 text-white font-bold px-8 py-4 rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 text-base">
            {WA_SVG}
            Book on WhatsApp
          </a>
        </div>
      </section>

      {/* ── 2. CARPET & UPHOLSTERY TABLE ── */}
      <section className="bg-white border-y border-silver-200 py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-2">Carpet &amp; Upholstery</h2>
            <p className="text-silver-600">Steam-cleaned. Deodorised. Dried in hours.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              ['1 room',   90],
              ['2 rooms', 150],
              ['3 rooms', 210],
              ['4 rooms', 270],
              ['5+ rooms', 330],
            ].map(([label, price]) => (
              <div key={String(label)} className="rounded-2xl p-5 text-center border border-royal-100 shadow-sm" style={{ background: '#e0f2fe' }}>
                <div className="text-royal-700 text-xs font-semibold mb-1">{label}</div>
                <div className="font-display font-bold text-3xl text-navy-900">£{price}</div>
                <div className="text-royal-700 text-[11px] font-medium mt-1">carpeted rooms</div>
              </div>
            ))}
          </div>

          <p className="text-center text-silver-500 text-xs mb-4">Count any carpeted room — bedrooms, living room, dining room. Stairs priced separately.</p>

          {/* Add-ons row */}
          <div className="bg-silver-100 rounded-2xl px-5 py-4 flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm mb-4">
            <span className="text-silver-600">Add-ons:</span>
            <span className="text-navy-800 font-semibold">Sofa (2–3 seats) <span className="text-royal-600">+£40</span></span>
            <span className="text-silver-300">·</span>
            <span className="text-navy-800 font-semibold">Mattress <span className="text-royal-600">+£25</span></span>
            <span className="text-silver-300">·</span>
            <span className="text-navy-800 font-semibold">Flights of stairs <span className="text-royal-600">+£45 (1st) · +£35 each extra</span></span>
          </div>

          <p className="text-center text-silver-500 text-xs mb-3">Minimum call-out £75</p>

          <p className="text-center text-[#1a5c3a] text-sm font-semibold bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 max-w-md mx-auto">
            Add whole-home carpets to any property clean and save £10.
          </p>
        </div>
      </section>

      {/* ── 3. EXTRAS GRID ── */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-2">Optional Extras</h2>
          <p className="text-silver-600">Tap to add to your booking.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: 'Inside oven',             price: 'FREE with every End of Tenancy · +£35 on its own',  highlight: true },
            { label: 'Fridge / freezer',         price: '+£20' },
            { label: 'Exterior windows',         price: '+£35' },
            { label: 'Wall marks & scuffs',      price: '+£25' },
            { label: 'Key collection/return',    price: '+£10' },
            { label: 'Rubbish removal (small load)', price: '+£40' },
            { label: 'Carpet bundle — studio/1 bed', price: '+£50' },
            { label: 'Carpet bundle — 2 bed',    price: '+£75' },
            { label: 'Carpet bundle — 3 bed',    price: '+£100' },
            { label: 'Carpet bundle — 4+ bed',   price: '+£125' },
          ].map((item) => (
            <div key={item.label}
              className={`rounded-2xl px-4 py-4 border text-sm transition-all duration-200 ${item.highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-silver-200'}`}>
              <div className="font-semibold text-navy-800 mb-1 leading-snug">{item.label}</div>
              <div className={`text-xs font-bold ${item.highlight ? 'text-amber-700' : 'text-royal-600'}`}>{item.price}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. QUOTE-ONLY SERVICES ── */}
      <section className="bg-navy-950 py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">Quote-Only Services</h2>
            <p className="text-silver-400">Send a photo via WhatsApp — priced in minutes.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Window Cleaning',       from: '£45',           desc: 'Exterior only. All sizes.',                            minNote: true },
              { title: 'Pressure Washing',       from: '£120',          desc: 'Driveways, patios & paths.',                           minNote: true },
              { title: 'Garden Services',        from: '£45',           desc: 'Clearance, tidy & maintenance.',                       minNote: true },
              { title: 'Commercial & Communal',  from: 'Free site visit', desc: 'Fixed monthly quote. Invoiced on 14-day terms.',     minNote: false },
            ].map((card) => (
              <div key={card.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3">
                <div>
                  <div className="text-white font-bold text-base mb-1">{card.title}</div>
                  <div className="text-silver-400 text-xs leading-relaxed">{card.desc}</div>
                </div>
                <div className="font-display font-bold text-2xl text-amber-400">{card.from}</div>
                {card.minNote && (
                  <p className="text-silver-500 text-[10px] leading-snug -mt-1">Minimum call-out £75 on standalone visits</p>
                )}
                <a href={WA_PHOTO} target="_blank" rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors">
                  {WA_SVG}
                  WhatsApp a photo — priced in minutes
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHAT'S ALWAYS INCLUDED ── */}
      <section className="py-14 px-4" style={{ backgroundColor: '#1a3d2b' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">What's Always Included</h2>
            <p className="text-green-300 text-sm">Every booking, no exceptions.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              '67-point agency checklist',
              'Photos + cleaning receipt for your agent',
              '48-hour free re-clean if anything is flagged',
              '£15 off if we arrive over an hour late',
              'Free reschedule until 12pm the day before',
              'Refer a friend — you BOTH get £15 off',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 bg-white/5 rounded-xl px-5 py-4 border border-white/10">
                <span className="text-amber-400 font-bold text-base flex-shrink-0 mt-0.5">✓</span>
                <span className="text-white text-sm leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. MINI FAQ ── */}
      <section className="bg-white py-14 px-4 border-t border-silver-200">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl font-bold text-navy-900 mb-2">Common Questions</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'When do I pay?',
                a: "£30 deposit by secure card link at booking. Balance is due after you've checked the work. Businesses are invoiced monthly.",
              },
              {
                q: 'Are prices really fixed?',
                a: 'Yes. The price you tap is the price you pay. The only additions are extras YOU choose.',
              },
              {
                q: 'Do you clean occupied homes?',
                a: 'Not yet. We specialise in vacant properties, commercial spaces, and outdoor work.',
              },
            ].map((faq) => (
              <details key={faq.q}
                className="group bg-silver-100 rounded-2xl border border-silver-200 overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-semibold text-navy-900 text-sm select-none">
                  {faq.q}
                  <span className="text-silver-400 group-open:rotate-45 transition-transform duration-200 text-xl leading-none">+</span>
                </summary>
                <div className="px-5 pb-4 text-silver-600 text-sm leading-relaxed border-t border-silver-200 pt-3">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CTA ── */}
      <section className="bg-navy-950 py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">Got your price? Lock in your date.</h2>
          <p className="text-silver-400 mb-8 text-base">We confirm every slot within 1 hour during business hours.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={WA_SIMPLE} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 bg-[#22C55E] hover:opacity-90 text-white font-bold px-8 py-4 rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 text-base">
              {WA_SVG}
              Book on WhatsApp
            </a>
            <a href="tel:02080502233"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white font-bold px-8 py-4 rounded-full transition-all duration-300 hover:bg-white hover:text-navy-900 text-base">
              Call 020 8050 2233
            </a>
          </div>
        </div>
      </section>

      <Footer />

      {/* ── 8. MOBILE STICKY BOTTOM BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-silver-200 shadow-xl">
        <div className="grid grid-cols-2 divide-x divide-silver-200">
          <a href="tel:02080502233"
            className="flex items-center justify-center gap-2 py-4 font-bold text-navy-900 text-sm active:bg-silver-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Call us
          </a>
          <a href={WA_SIMPLE} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 font-bold text-white text-sm bg-[#22C55E] active:opacity-90 transition-colors">
            {WA_SVG}
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
