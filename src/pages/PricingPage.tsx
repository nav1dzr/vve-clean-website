import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FaqSchema from '../components/FaqSchema';
import GoogleBadge from '../components/GoogleBadge';
import {
 EOT_BASE_PRICES_P, EOT_TAILORED_START_PRICES_P, EOT_EXTRA_BATH_P, EOT_EXTRA_WC_P,
 MOVEIN_BASE_PRICES_P, MOVEIN_EXTRA_BATH_P, MOVEIN_EXTRA_WC_P,
 CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, STAIRS_FIRST_P, STAIRS_EXTRA_P,
 ADDON_PRICES_P, AFTER_BUILDERS_START_FROM_P, WINDOW_CLEANING_FROM_P, WINDOW_CLEANING_MIN_P,
 WINDOW_CLEANING_SCOPE, GARDEN_SERVICES_FROM_P, GARDEN_SERVICES_MIN_P, PRESSURE_WASHING_FROM_P,
 EOT_CARPET_PACKAGE_DISCOUNT_PCT, EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS, EOT_GUARANTEE_HOURS,
} from '../data/pricing';
const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: pence % 100 ? 2 : 0 }).format(pence / 100);
const WA = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20please%20help%20me%20choose%20the%20right%20clean.';
const SIZES = [['studio','Studio'],['bed1','1 bedroom'],['bed2','2 bedrooms'],['bed3','3 bedrooms'],['bed4','4 bedrooms']] as const;
const categories = ['End of tenancy', 'Carpets', 'Sofas & upholstery', 'Other cleans'] as const;
const PRICING_FAQS = [
  { q: 'When do I pay?', a: 'Request a preferred time free. After we agree the scope, total and time with you, we send a £30 deposit link. Paying confirms the booking; the deposit counts towards the total and the remaining balance is normally due after the service.' },
  { q: 'What do the published prices cover?', a: 'The tables show the standard scope for normally maintained properties. Select the service and property details to see the applicable price and included work.' },
  { q: 'Can the price change?', a: 'If the information supplied does not match the condition or scope on arrival, VVE Clean will explain the difference and agree any revised price before additional work starts.' },
  { q: 'Can I request a same-day or next-day visit?', a: 'You can send any preferred date, but availability varies by service, area and property size. Contact VVE Clean first if the timing is critical.' },
  { q: 'Do you clean occupied homes?', a: 'Tell us whether the property is occupied when you enquire. VVE Clean will confirm whether the requested service and access arrangements are suitable before booking.' },
];


function PriceRows({ rows }: { rows: [string, number | string][] }) {
 return <dl className="divide-y divide-slate-100">{rows.map(([label, price]) => <div key={label} className="flex items-start justify-between gap-5 py-3.5"><dt className="text-sm text-slate-700">{label}</dt><dd className="shrink-0 text-sm font-bold text-navy-950">{typeof price === 'number' ? money(price) : price}</dd></div>)}</dl>;
}
function QuoteLink({ to, children }: { to: string; children: React.ReactNode }) {
 return <Link to={to} className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-royal-600 px-6 py-3 text-sm font-bold text-white hover:bg-royal-700">{children}<ChevronRight size={18} /></Link>;
}
export default function PricingPage() {
 const [category, setCategory] = useState<typeof categories[number]>('End of tenancy');
 return <div className="min-h-screen bg-slate-50 mobile-page-bottom lg:pb-0">
  <FaqSchema items={PRICING_FAQS} /><Navbar />
  <main id="main-content">
   <section className="service-hero px-4 pb-10 pt-28 sm:pb-14 sm:pt-36">
    <div className="mx-auto max-w-5xl">
     <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-royal-700">Prices &amp; what is included</p>
     <h1 className="font-display text-4xl font-bold tracking-tight text-navy-950 sm:text-5xl">Find the right clean.<br />See a clear price.</h1>
     <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">Choose your service below. Check the scope, build your quote and request a preferred time with no payment.</p>
     <div className="mt-5"><GoogleBadge /></div>
    </div>
   </section>
   <section className="mx-auto max-w-5xl px-4 py-9 sm:py-12" aria-label="Service prices">
    <h2 className="font-display text-xl font-bold text-navy-950">What would you like cleaned?</h2>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Choose a pricing service">
     {categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-[52px] rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${category === item ? 'border-royal-600 bg-royal-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-royal-500'}`}>{item}</button>)}
    </div>
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
     <div hidden={category !== 'End of tenancy'}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-2xl font-bold text-navy-950">End of tenancy cleaning</h3><p className="mt-2 text-sm text-slate-600">Flat prices · one bathroom · vacant, normally maintained property</p></div><span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-royal-800">Oven cleaning included in both</span></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
       <div className="rounded-xl bg-sky-50 p-4"><h4 className="font-bold text-navy-950">Complete</h4><p className="mt-1 text-sm leading-relaxed text-slate-600">Our full 67-point checklist, including internal appliances, cupboards and storage. For a full move-out clean.</p></div>
       <div className="rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-navy-950">Tailored</h4><p className="mt-1 text-sm leading-relaxed text-slate-600">Selected internal tasks with oven cleaning included. Choose any additional work in your quote.</p></div>
      </div>
      <table className="mt-5 w-full text-sm"><caption className="sr-only">End of tenancy flat prices by property size and package</caption><thead><tr className="border-b border-slate-200"><th className="py-3 text-left font-medium text-slate-500">Property</th><th className="py-3 text-right text-royal-800">Complete</th><th className="py-3 text-right text-slate-600">Tailored from</th></tr></thead><tbody>{SIZES.map(([key,label]) => <tr key={key} className="border-b border-slate-100"><th className="py-4 text-left font-medium text-slate-700">{label}</th><td className="py-4 text-right font-bold text-navy-950">{money(EOT_BASE_PRICES_P[key])}</td><td className="py-4 text-right font-semibold text-slate-600">{money(EOT_TAILORED_START_PRICES_P[key])}</td></tr>)}</tbody></table>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">Extra bathroom {money(EOT_EXTRA_BATH_P)} · extra WC {money(EOT_EXTRA_WC_P)}. Houses and maisonettes have their own prices in the calculator. For 5+ bedrooms, contact us for an individual quote.</p>
      <p className="mt-4 flex gap-2 text-sm leading-relaxed text-slate-700"><Check size={18} className="mt-0.5 shrink-0 text-emerald-700" />Report missed agreed work within {EOT_GUARANTEE_HOURS / 24} days for one covered re-clean. Complete covers the full checklist; Tailored covers your selected tasks.</p>
      <QuoteLink to="/end-of-tenancy-cleaning-london#quote">Build my end of tenancy quote</QuoteLink>
      <details data-disclosure="pricing-not-faq" className="mt-5 border-t border-slate-100 pt-2"><summary className="cursor-pointer py-3 text-sm font-semibold text-navy-900">Adding professional carpet cleaning?</summary><p className="pb-3 text-sm leading-relaxed text-slate-600">Save {EOT_CARPET_PACKAGE_DISCOUNT_PCT}% on qualifying carpet cleaning with your end of tenancy service when you select {EOT_CARPET_PACKAGE_MIN_QUALIFYING_AREAS}+ qualifying areas. Smaller selections use the standard carpet add-on prices. The calculator shows the actual saving before you request a time.</p></details>
     </div>
     <div hidden={category !== 'Carpets'}>
      <h3 className="font-display text-2xl font-bold text-navy-950">Carpet cleaning</h3><p className="mt-2 text-sm text-slate-600">Choose your rooms and areas. {money(CARPET_MIN_BOOKING_P)} minimum per visit.</p>
      <PriceRows rows={[[ 'Bedroom',CARPET_ITEM_PRICES_P.bedroom],['Living / dining room',CARPET_ITEM_PRICES_P.living_room],['Large or through lounge',CARPET_ITEM_PRICES_P.large_lounge],['Hallway',CARPET_ITEM_PRICES_P.hallway],['Landing',CARPET_ITEM_PRICES_P.landing],['Stairs — first flight',STAIRS_FIRST_P],['Stairs — each extra flight',STAIRS_EXTRA_P],['Rugs','Photo assessment']]} />
      <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm leading-relaxed text-slate-700">Your total includes any applicable same-visit saving, subject to the minimum visit charge. Rugs need a photo assessment and are available alongside carpet, upholstery or relevant end of tenancy cleaning.</p>
      <QuoteLink to="/carpet-cleaning-london#quote">Choose my rooms</QuoteLink>
     </div>
     <div hidden={category !== 'Sofas & upholstery'}>
      <h3 className="font-display text-2xl font-bold text-navy-950">Sofas &amp; upholstery</h3><p className="mt-2 text-sm text-slate-600">Prices per item. {money(CARPET_MIN_BOOKING_P)} minimum per visit, including mixed carpet and upholstery selections.</p>
      <PriceRows rows={[[ 'Armchair',CARPET_ITEM_PRICES_P.armchair],['2-seater sofa',CARPET_ITEM_PRICES_P.sofa_2],['3-seater sofa',CARPET_ITEM_PRICES_P.sofa_3],['Corner / L-shaped sofa',CARPET_ITEM_PRICES_P.sofa_corner],['Mattress (single)',CARPET_ITEM_PRICES_P.mattress_single],['Mattress (double)',CARPET_ITEM_PRICES_P.mattress_double],['Mattress (king)',CARPET_ITEM_PRICES_P.mattress_king]]} />
      <p className="mt-4 text-sm leading-relaxed text-slate-600">Suitable fabrics are assessed before treatment. For delicate materials or uncertain fabric types, send a photograph first.</p><QuoteLink to="/sofa-cleaning-london#quote">Choose my furniture</QuoteLink>
     </div>
     <div hidden={category !== 'Other cleans'}>
      <h3 className="font-display text-2xl font-bold text-navy-950">Move-in deep cleaning</h3><p className="mt-2 text-sm text-slate-600">For a normally maintained, vacant property with one bathroom.</p>
      <PriceRows rows={SIZES.map(([key,label]) => [label, MOVEIN_BASE_PRICES_P[key]])} />
      <p className="mt-3 text-sm text-slate-600">Extra bathroom {money(MOVEIN_EXTRA_BATH_P)} · extra WC {money(MOVEIN_EXTRA_WC_P)}.</p>
      <h3 className="mt-8 font-display text-xl font-bold text-navy-950">Services quoted after a scope review</h3>
      <div className="mt-4 divide-y divide-slate-100">{[
       ['After Builders Clean',`From ${money(AFTER_BUILDERS_START_FROM_P)}`,'Send photos of the work and dust so we can confirm the scope.'],
       ['Window Cleaning',`From ${money(WINDOW_CLEANING_FROM_P)}`,`${WINDOW_CLEANING_SCOPE} Minimum standalone visit ${money(WINDOW_CLEANING_MIN_P)}.`],
       ['Pressure Washing',`From ${money(PRESSURE_WASHING_FROM_P)}`,'Driveways, patios and paths.'],
       ['Garden Services',`From ${money(GARDEN_SERVICES_FROM_P)}`,`Clearance, tidy and maintenance. Minimum standalone visit ${money(GARDEN_SERVICES_MIN_P)}.`],
       ['Commercial & Communal','Written quote','Site, access and cleaning scope reviewed before agreement.'],
      ].map(([title,price,description]) => <div key={title} className="py-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-navy-900">{title}</h4><p className="text-sm font-bold text-royal-800">{price}</p></div><p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p></div>)}</div>
      <a href={WA} target="_blank" rel="noopener noreferrer" className="whatsapp-text-link mt-5 inline-flex min-h-[44px] items-center font-bold underline underline-offset-4">Ask about another clean</a>
     </div>
    </div>
    <details data-disclosure="pricing-not-faq" className="mt-4 rounded-xl border border-slate-200 bg-white px-5"><summary className="cursor-pointer py-4 font-semibold text-navy-900">Optional extras and access costs</summary><div className="pb-5"><p className="mb-2 text-sm leading-relaxed text-slate-600">Add only what you need. Oven cleaning is already included in both end of tenancy packages; Complete also includes internal fridge/freezer cleaning. The calculator applies the selected service's inclusions.</p><PriceRows rows={[[ 'Oven, hob & extractor add-on',ADDON_PRICES_P.oven],['Inside fridge / freezer add-on',ADDON_PRICES_P.fridge],['Exterior windows',ADDON_PRICES_P.ext_windows],['Wall marks & scuffs',ADDON_PRICES_P.wall_marks],['Key collection/return',ADDON_PRICES_P.key_collect],['Rubbish removal (small load)',ADDON_PRICES_P.rubbish]]} /><p className="mt-3 text-sm leading-relaxed text-slate-600">Parking and any applicable Congestion Charge are shown separately and agreed with you. Heavy soiling, mould, excessive rubbish, contamination or strong odours require photo review and an agreed scope before work starts.</p></div></details>
   </section>
   <section className="border-y border-slate-200 bg-white px-4 py-10"><div className="mx-auto max-w-5xl"><h2 className="font-display text-2xl font-bold text-navy-950">Know what happens next</h2><ol className="mt-5 grid gap-6 sm:grid-cols-3">{[['01','Request free','Choose the service and your preferred time. No payment is taken.'],['02','Agree the details','We confirm availability, scope, price and any access costs with you.'],['03','Confirm with £30','Pay the deposit from your agreed offer. It counts towards your total; the balance is normally due after cleaning.']].map(([number,title,text]) => <li key={number}><span className="text-xs font-bold text-royal-600">{number}</span><h3 className="mt-2 font-bold text-navy-950">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p></li>)}</ol></div></section>
   <section className="mx-auto max-w-3xl px-4 py-12"><h2 className="mb-5 font-display text-2xl font-bold text-navy-950">A few useful answers</h2><div className="divide-y divide-slate-200">{PRICING_FAQS.map(faq => <details key={faq.q}><summary className="cursor-pointer py-4 font-semibold text-navy-900">{faq.q}</summary><div className="faq-answer pb-5 text-sm leading-relaxed text-slate-600">{faq.a}</div></details>)}</div><p className="mt-6 text-sm text-slate-600">Need help choosing? <a className="whatsapp-text-link font-semibold underline underline-offset-4" href={WA} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a> or <a href="tel:02080502233" className="underline underline-offset-4">call 020 8050 2233</a>.</p></section>
  </main><Footer />
  <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-slate-200" style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}><div className="flex items-stretch pb-[env(safe-area-inset-bottom)]"><Link to="/#quote" className="flex flex-1 min-h-[52px] items-center justify-center bg-royal-600 px-4 text-sm font-bold text-white">Get my price</Link><a href={WA} target="_blank" rel="noopener noreferrer" className="whatsapp-text-link flex flex-1 min-h-[52px] items-center justify-center px-4 text-sm font-bold">WhatsApp us</a></div></div>
 </div>;
}
