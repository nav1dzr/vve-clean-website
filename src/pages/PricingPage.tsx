import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  EOT_BASE_PRICES_P,
  EOT_EXTRA_BATH_P,
  EOT_EXTRA_WC_P,
  MOVEIN_BASE_PRICES_P,
  MOVEIN_EXTRA_BATH_P,
  EOT_CARPET_ADDON_PRICES_P,
  AFTER_BUILDERS_START_FROM_P,
  CARPET_ITEM_PRICES_P,
  STAIRS_FIRST_P,
  STAIRS_EXTRA_P,
  CARPET_MIN_BOOKING_P,
  ADDON_PRICES_P,
  CARPET_BUNDLE_TIERS,
  SAME_DAY_POLICY_SHORT,
} from '../data/pricing';

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_BASE   = 'https://wa.me/447845451111';
const WA_SIMPLE = `${WA_BASE}?text=${encodeURIComponent("Hi VVE Clean! I'd like to book a clean.")}`;
const WA_PHOTO  = `${WA_BASE}?text=${encodeURIComponent("Hi VVE Clean! I'd like to send a photo for a quote.")}`;

const p = (pence: number) => `£${pence / 100}`;  // display helper

const WA_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// ─── Price tables ─────────────────────────────────────────────────────────────

const EOT_ROWS: [string, number, number][] = [
  ['Studio',    EOT_BASE_PRICES_P.studio / 100,  MOVEIN_BASE_PRICES_P.studio / 100],
  ['1 Bed',     EOT_BASE_PRICES_P.bed1   / 100,  MOVEIN_BASE_PRICES_P.bed1   / 100],
  ['2 Bed',     EOT_BASE_PRICES_P.bed2   / 100,  MOVEIN_BASE_PRICES_P.bed2   / 100],
  ['3 Bed',     EOT_BASE_PRICES_P.bed3   / 100,  MOVEIN_BASE_PRICES_P.bed3   / 100],
  ['4+ Bed',    EOT_BASE_PRICES_P.bed4   / 100,  MOVEIN_BASE_PRICES_P.bed4   / 100],
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-[56px] lg:pb-0">
      <Navbar />
      <main id="main-content">

      {/* ── Hero ── */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Transparent Pricing</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Clear Prices,<br />
            <span className="text-white">Zero Surprises</span>
          </h1>
          <p className="text-white text-lg max-w-xl mx-auto">
            Professional cleaning with clear, upfront pricing. Prices shown apply to normally maintained properties.
          </p>
          <div className="mt-6">
            <Link to="/booking"
              className="inline-flex items-center justify-center gap-2 bg-royal-500 hover:bg-royal-600 text-white font-semibold text-sm sm:text-base px-6 py-3 min-h-[44px] rounded-lg transition-all duration-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Get my price — book online
            </Link>
          </div>
        </div>
      </div>

      {/* ── 1. VACANT PROPERTY CLEANS TABLE ── */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-2">Vacant Property Cleans</h2>
          <p className="text-silver-700">Fixed prices for normally maintained, vacant properties.</p>
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
                    <span className="text-green-400 text-[10px] font-normal normal-case tracking-normal">Complete package — appliances, cupboards and internal windows included</span>
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold text-silver-300 uppercase tracking-widest text-xs">Move-in Deep Clean</th>
              </tr>
            </thead>
            <tbody>
              {EOT_ROWS.map(([size, eot, movein], i) => (
                <tr key={size} className={i % 2 === 0 ? 'bg-white' : 'bg-silver-100/60'}>
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
          {EOT_ROWS.map(([size, eot, movein]) => (
            <div key={size} className="bg-white rounded-2xl border border-silver-200 p-5 shadow-sm">
              <div className="font-bold text-navy-900 text-base mb-3">{size}</div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="bg-royal-50 rounded-xl p-3">
                  <div className="text-royal-600 font-bold text-lg">£{eot}</div>
                  <div className="text-silver-700 mt-0.5">End of Tenancy</div>
                  <div className="text-green-600 text-[9px] font-semibold mt-0.5">Complete package</div>
                </div>
                <div className="bg-silver-100 rounded-xl p-3">
                  <div className="text-navy-900 font-bold text-lg">£{movein}</div>
                  <div className="text-silver-700 mt-0.5">Move-in</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="text-silver-500 text-xs mt-4 text-center leading-relaxed">
          Each extra bathroom: <strong className="text-navy-700">+{p(EOT_EXTRA_BATH_P)}</strong> end of tenancy &nbsp;·&nbsp; <strong className="text-navy-700">+{p(MOVEIN_EXTRA_BATH_P)}</strong> move-in &nbsp;·&nbsp; Additional WC: <strong className="text-navy-700">+{p(EOT_EXTRA_WC_P)}</strong> (EOT)
        </p>

        {/* Condition note */}
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3.5 mt-4"
          style={{ background: '#dbeafe', borderLeft: '4px solid #0284c7' }}
        >
          <span className="flex-shrink-0 font-bold text-base leading-none mt-0.5" style={{ color: '#0284c7' }}>ℹ</span>
          <p className="text-navy-900 text-xs leading-relaxed font-medium">
            Prices assume the property is vacant and in normal condition. Heavy soiling, mould, excessive rubbish, biohazard contamination, pet accidents, strong odours, or large permanent stains require photo or video review and a revised quote agreed with you before work starts. Congestion zone and parking charges are passed through at cost where applicable.
          </p>
        </div>

        {/* After Builders callout */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <div className="font-display text-lg font-bold text-navy-900 mb-1">After Builders Clean</div>
            <div className="text-amber-700 text-sm font-semibold mb-2">From £{AFTER_BUILDERS_START_FROM_P / 100} — estimated price confirmed after a photo</div>
            <p className="text-silver-600 text-sm leading-relaxed max-w-lg">
              Post-construction results depend heavily on scope. Send us a photo and we'll confirm your price before any work starts.
            </p>
          </div>
          <a href={WA_PHOTO} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 btn-whatsapp font-bold px-5 py-3 rounded-xl transition-all duration-200 text-sm whitespace-nowrap">
            {WA_SVG}
            WhatsApp a photo
          </a>
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-8">
          <a href={WA_SIMPLE} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 btn-whatsapp font-bold px-8 py-4 rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 text-base">
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

          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            {/* Carpets */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-navy-700 font-bold text-xs uppercase tracking-widest">Carpets</span>
                <div className="flex-1 h-px bg-silver-200" />
              </div>
              <div className="space-y-2">
                {([
                  ['Bedroom',                 CARPET_ITEM_PRICES_P.bedroom       / 100, null],
                  ['Living / dining room',    CARPET_ITEM_PRICES_P.living_room   / 100, null],
                  ['Large or through lounge', CARPET_ITEM_PRICES_P.large_lounge  / 100, null],
                  ['Hallway',                 CARPET_ITEM_PRICES_P.hallway        / 100, null],
                  ['Landing',                 CARPET_ITEM_PRICES_P.landing        / 100, null],
                  ['Stairs — first flight',   STAIRS_FIRST_P                     / 100, null],
                  ['Stairs — each extra',     STAIRS_EXTRA_P                     / 100, null],
                  ['Rug',                     CARPET_ITEM_PRICES_P.rug            / 100, 'Large or wool rugs — photo quote'],
                ] as [string, number, string | null][]).map(([label, price, note]) => (
                  <div key={label} className="flex items-start justify-between bg-silver-100 rounded-xl px-4 py-3 border border-silver-200">
                    <div>
                      <div className="text-navy-800 text-sm font-medium">{label}</div>
                      {note && <div className="text-silver-600 text-[11px] mt-0.5">{note}</div>}
                    </div>
                    <div className="font-display font-bold text-lg text-royal-600 ml-4 whitespace-nowrap">£{price}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sofas & Upholstery */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-navy-700 font-bold text-xs uppercase tracking-widest">Sofas &amp; Upholstery</span>
                <div className="flex-1 h-px bg-silver-200" />
              </div>
              <div className="space-y-2">
                {([
                  ['Armchair',               CARPET_ITEM_PRICES_P.armchair        / 100],
                  ['2-seater sofa',          CARPET_ITEM_PRICES_P.sofa_2          / 100],
                  ['3-seater sofa',          CARPET_ITEM_PRICES_P.sofa_3          / 100],
                  ['Corner / L-shaped sofa', CARPET_ITEM_PRICES_P.sofa_corner     / 100],
                  ['Mattress (single)',       CARPET_ITEM_PRICES_P.mattress_single / 100],
                  ['Mattress (double/king)',  CARPET_ITEM_PRICES_P.mattress_double / 100],
                ] as [string, number][]).map(([label, price]) => (
                  <div key={label} className="flex items-center justify-between bg-silver-100 rounded-xl px-4 py-3 border border-silver-200">
                    <div className="text-navy-800 text-sm font-medium">{label}</div>
                    <div className="font-display font-bold text-lg text-royal-600 ml-4">£{price}</div>
                  </div>
                ))}
              </div>

              {/* EOT carpet add-ons */}
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-navy-700 font-bold text-xs uppercase tracking-widest">EOT carpet add-ons</span>
                  <div className="flex-1 h-px bg-silver-200" />
                </div>
                <p className="text-silver-600 text-xs mb-2 leading-relaxed">
                  Reduced rates when carpet cleaning is added to an end-of-tenancy booking (travel &amp; setup already covered).
                </p>
                <div className="space-y-2">
                  {([
                    ['Bedroom carpet',         EOT_CARPET_ADDON_PRICES_P.bedroom     / 100],
                    ['Living / dining room',   EOT_CARPET_ADDON_PRICES_P.living_room / 100],
                    ['Large room / lounge',    EOT_CARPET_ADDON_PRICES_P.large_lounge/ 100],
                    ['Hallway',                EOT_CARPET_ADDON_PRICES_P.hallway     / 100],
                    ['Landing',                EOT_CARPET_ADDON_PRICES_P.landing     / 100],
                    ['Stairs — first flight',  EOT_CARPET_ADDON_PRICES_P.stairs_first/ 100],
                    ['Stairs — each extra',    EOT_CARPET_ADDON_PRICES_P.stairs_extra/ 100],
                  ] as [string, number][]).map(([label, price]) => (
                    <div key={label} className="flex items-center justify-between bg-silver-50 rounded-xl px-4 py-2.5 border border-silver-200">
                      <div className="text-navy-800 text-sm">{label}</div>
                      <div className="font-bold text-navy-900 ml-4">£{price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Minimum booking notice */}
          <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 max-w-md mx-auto mb-4">
            <span className="text-amber-700 text-sm font-semibold">£{CARPET_MIN_BOOKING_P / 100} minimum booking</span>
          </div>

          <p className="text-center text-[#1a5c3a] text-sm font-semibold bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 max-w-md mx-auto">
            Book multiple items together and save automatically — {CARPET_BUNDLE_TIERS.map((t) => `${t.display} over £${t.minP / 100}`).join(', ')}.
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
            { label: 'Oven, hob & extractor',      price: `Included with every Complete EOT · +£${ADDON_PRICES_P.oven / 100} on its own`, highlight: true },
            { label: 'Inside fridge / freezer',    price: `Included with every Complete EOT · +£${ADDON_PRICES_P.fridge / 100} on its own`, highlight: true },
            { label: 'Exterior windows',           price: `+£${ADDON_PRICES_P.ext_windows / 100}` },
            { label: 'Wall marks & scuffs',        price: `+£${ADDON_PRICES_P.wall_marks / 100}` },
            { label: 'Key collection/return',      price: `+£${ADDON_PRICES_P.key_collect / 100}` },
            { label: 'Rubbish removal (small load)', price: `+£${ADDON_PRICES_P.rubbish / 100}` },
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
              { title: 'Window Cleaning',       from: '£45',             desc: 'Exterior only. All sizes.',                         minNote: true  },
              { title: 'Pressure Washing',       from: '£120',            desc: 'Driveways, patios & paths.',                        minNote: true  },
              { title: 'Garden Services',        from: '£45',             desc: 'Clearance, tidy & maintenance.',                    minNote: true  },
              { title: 'Commercial & Communal',  from: 'Free site visit', desc: 'Fixed written quote. Invoiced on 14-day terms.',    minNote: false },
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
                a: 'Yes, for normally maintained properties. The only additions are extras you choose to add.',
              },
              {
                q: 'Can the price change?',
                a: 'Our prices are fixed for normal condition properties based on the details provided. For heavier conditions, we will review photos and confirm the price before you book. No hidden fees — any additional work is explained and agreed first.',
              },
              {
                q: 'Can I book same-day or next-day?',
                a: SAME_DAY_POLICY_SHORT,
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
          <p className="text-silver-400 mb-2 text-base">We confirm every slot within 1 hour during business hours.</p>
          <p className="text-amber-300 mb-8 text-sm font-semibold">Book online with a £30 deposit — it comes straight off your bill.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/#quote"
              className="inline-flex items-center justify-center gap-2.5 bg-royal-500 hover:bg-royal-600 text-white font-bold px-8 py-4 min-h-[44px] rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Book online now
            </Link>
            <a href={WA_SIMPLE} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 btn-whatsapp font-bold px-8 py-4 min-h-[44px] rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {WA_SVG}
              Book on WhatsApp
            </a>
            <a href="tel:02080502233"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white font-bold px-8 py-4 min-h-[44px] rounded-full transition-all duration-300 hover:bg-white hover:text-navy-900 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Call 020 8050 2233
            </a>
          </div>
        </div>
      </section>

      </main>
      <Footer />

      {/* ── 8. MOBILE STICKY BOTTOM BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-silver-200 shadow-xl transition-[bottom] duration-200"
        style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}>
        <div className="grid grid-cols-2 divide-x divide-silver-200">
          <a href="tel:02080502233"
            className="flex items-center justify-center gap-2 py-4 font-bold text-navy-900 text-sm active:bg-silver-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Call us
          </a>
          <a href={WA_SIMPLE} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 font-bold text-white text-sm btn-whatsapp transition-colors">
            {WA_SVG}
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
