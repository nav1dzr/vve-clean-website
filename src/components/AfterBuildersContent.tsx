import { ArrowRight, Camera, Check, ChevronDown, ClipboardCheck, FileText, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BUILDERS_FAQS, BUILDERS_PRICES, BUILDERS_ROOMS, BUILDERS_WHATSAPP } from '../data/afterBuildersContent';
import { AFTER_BUILDERS_START_FROM_P, DEPOSIT_P, penceToDisplay } from '../data/pricing';
import { AREAS } from '../data/areas';
import PriceTaxNote from './PriceTaxNote';

const NAV = [
  ['builders-prices', 'Prices'], ['builders-checklist', 'Cleaning checklist'],
  ['builders-levels', 'Cleaning stages'], ['builders-process', 'How it works'],
  ['builders-faq', 'Questions'], ['builders-quote', 'Get a quote'],
];

function PhotoQuoteLink({ children = 'Send photos for a fixed quote', location }: { children?: React.ReactNode; location: string }) {
  return <a href={BUILDERS_WHATSAPP} target="_blank" rel="noopener noreferrer" className="builders-button" data-track-location={location}><Camera size={19} aria-hidden="true" />{children}<ArrowRight size={18} aria-hidden="true" /></a>;
}

export function AfterBuildersQuoteCard() {
  return <aside className="builders-quote-card" aria-label="After-builders price at a glance">
    <div className="builders-quote-card-top">
      <div className="flex items-center justify-between gap-4"><span className="builders-kicker !mb-0">Your project. A fixed quote.</span><ClipboardCheck size={26} className="text-sky-200" aria-hidden="true" /></div>
      <p className="mt-6 text-sm text-sky-100">Small renovation / one main area</p>
      <p className="mt-1 font-display text-5xl font-bold tracking-tight"><span className="mr-2 font-sans text-base font-normal text-sky-100">from</span>{penceToDisplay(AFTER_BUILDERS_START_FROM_P)}</p>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-sky-100">A starting guide. Photos, surfaces and access determine your final written quote.</p>
      <dl className="builders-quick-prices">
        {BUILDERS_PRICES.filter((price) => ['studio', 'bed1', 'bed2'].includes(price.key)).map((price, index) => <div key={price.key}><dt className="text-xs text-sky-100">{['Studio', '1 bedroom', '2 bedrooms'][index]}</dt><dd className="mt-1 text-lg font-bold"><span className="text-xs font-normal">from </span>{penceToDisplay(price.pence)}</dd></div>)}
      </dl>
    </div>
    <div className="builders-quote-card-bottom flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-600">No VAT added · equipment supplied</span><a className="builders-link text-sm" href="#builders-prices">All starting prices <ArrowRight size={16} aria-hidden="true" /></a></div>
  </aside>;
}

function PricingGuide() {
  return <section id="builders-prices" className="builders-section bg-white" aria-labelledby="builders-prices-title">
    <div className="builders-wrap">
      <span className="builders-kicker">01 / Price guide</span>
      <h2 id="builders-prices-title">A useful starting point.<br />A fixed price before we start.</h2>
      <p className="builders-lead">Bedroom count helps, but two similar flats can need very different cleans. These are VVE Clean starting prices for London properties, not a checkout total or an hourly rate.</p>
      <div className="builders-price-layout">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="builders-price-table"><caption className="sr-only">VVE Clean after-builders starting prices. Final scope and price require assessment.</caption><thead><tr><th scope="col">Property / project</th><th scope="col">Starting price</th></tr></thead><tbody>
            {BUILDERS_PRICES.map((price) => <tr key={price.key} data-price-key={price.key}><td><span className="font-semibold">{price.label}</span><small>{price.note}</small></td><td>from {penceToDisplay(price.pence)}</td></tr>)}
            <tr><td><span className="font-semibold">5+ bedrooms / complex projects</span><small>Plans, photos or a site assessment before pricing.</small></td><td>By assessment</td></tr>
          </tbody></table>
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4"><PriceTaxNote /></div>
        </div>
        <aside className="space-y-5">
          <div className="builders-card !bg-[#edf6fb]">
            <h3>How to read these prices</h3>
            <p className="mt-3 text-sm text-slate-700">They are entry points for assessment, not all-inclusive packages. We need to know the floor area, work carried out, dust and residue, rooms, glazing and access.</p>
            <ul className="builders-checklist text-sm">
              {['Your quote names the rooms and cleaning tasks.', 'Equipment and products for that work are supplied.', 'Any parking, congestion or extra work is explained separately.'].map((text) => <li key={text}><Check size={17} aria-hidden="true" />{text}</li>)}
            </ul>
            <p className="mt-4 text-sm font-semibold text-navy-900">The agreed cleaning price is fixed. Changes need your agreement first.</p>
          </div>
          <PhotoQuoteLink location="after_builders_pricing" />
          <p className="text-sm leading-relaxed text-slate-600">New-build units, shops, offices or several properties? Send the floor area or plans and the handover schedule. <Link to="/commercial" className="builders-link text-sm">Commercial cleaning enquiries <ArrowRight size={15} aria-hidden="true" /></Link></p>
        </aside>
      </div>
    </div>
  </section>;
}

function ServiceAndCost() {
  const factors = [
    ['What work was done?', 'A new kitchen can leave dust beyond the kitchen. Plastering, sanding and full renovations need a different assessment from light decorating.'],
    ['How much space and detail?', 'Floor area, bathrooms, fitted cupboards, glazing and stairs matter more than bedroom count alone. Send plans for larger or unusual layouts.'],
    ['What is on the surfaces?', 'Loose dust is different from dried paint, grout haze or adhesive. Delicate materials and new finishes need suitable treatment and may limit what can be removed.'],
    ['What access and timing?', 'Parking, unloading, no lift, high areas and restricted hours affect the plan. Tell us if trades are returning or you need another visit before handover.'],
  ];
  return <section id="builders-service" className="builders-section builders-soft" aria-labelledby="builders-service-title"><div className="builders-wrap">
    <div className="builders-split"><div><span className="builders-kicker">02 / The work behind the price</span><h2 id="builders-service-title">Building work finished.<br />Dust still everywhere?</h2></div><div><p className="text-lg text-slate-700">After-builders cleaning deals with the fine dust and residue left by renovation. It reaches the agreed sills, storage, fittings and floors that a quick tidy can miss.</p><p className="mt-4 text-slate-600">A domestic clean focuses on everyday dirt. A deep clean adds more detail. Post-construction work also needs an assessment of new finishes, paint splashes and protective residue before choosing a method.</p></div></div>
    <div className="builders-grid builders-grid-2 builders-costs">{factors.map(([title, text]) => <article key={title}><h3>{title}</h3><p className="mt-3 max-w-lg text-slate-600">{text}</p></article>)}</div>
    <div className="builders-note mt-5"><strong>Send the whole picture.</strong><p className="mt-1 text-sm text-slate-700">A bathroom refit, an extension, a full renovation and a new-build handover are different jobs. Show us the affected rooms as well as the area where the work happened.</p></div>
  </div></section>;
}

function CleaningLevels() {
  const stages = [
    { number: '01', tag: 'During / just after works', title: 'Initial builders clean', body: 'The early stage, when a site may still have heavy dust, packaging and construction debris.', note: 'Arrange building-waste clearance with your contractor. Do not assume it is included in a cleaning visit.', cost: 'Needs a separate scope assessment.' },
    { number: '02', tag: 'The main clean', title: 'After-builders clean', body: 'Once the trades have finished: the agreed dust removal, rooms, fittings, glazing and suitable residue treatment.', note: 'This is the clean to discuss with us after a renovation. Your written list defines what is included.', cost: 'Use the starting guide, then get a fixed quote.' },
    { number: '03', tag: 'Close to handover', title: 'Final sparkle clean', body: 'A finishing visit after the main clean, checking presentation and touching up agreed surfaces before handover.', note: 'Fresh dust or returning trades may mean another visit. A second visit is not automatically included.', cost: 'Agree the tasks and any revisit price first.' },
  ];
  return <section id="builders-levels" className="builders-section bg-white" aria-labelledby="builders-levels-title"><div className="builders-wrap"><span className="builders-kicker">03 / Book the right stage</span><h2 id="builders-levels-title">Builders clean or sparkle clean?</h2><p className="builders-lead">The names vary between companies. Compare the actual work and number of visits, not just the package name. These stages explain the difference; they are not three fixed-price VVE packages.</p>
    <div className="builders-grid builders-grid-3 mt-8">{stages.map((stage, index) => <article key={stage.number} className={`builders-card builders-stage ${index === 1 ? 'builders-stage-featured' : ''}`}><span className="builders-stage-tag">{stage.tag}</span><h3>{stage.title}</h3><p className="mt-3 text-sm text-slate-600">{stage.body}</p><p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-700">{stage.note}</p><p className="mt-4 text-sm font-bold text-royal-700">{stage.cost}</p></article>)}</div>
  </div></section>;
}

function CleaningChecklist() {
  return <section id="builders-checklist" className="builders-section builders-soft" aria-labelledby="builders-checklist-title"><div className="builders-wrap builders-split">
    <div><span className="builders-kicker">04 / Room by room</span><h2 id="builders-checklist-title">What would you like included?</h2><p className="builders-lead">Use this checklist to show us what needs attention. We turn it into a cleaning list for your property, with the agreed tasks in your written quote.</p><div className="builders-note mt-6"><p className="text-sm"><strong>Included when listed in your quote.</strong> These are possible tasks, not a promise that everything below is included in every starting price.</p></div><a className="builders-link mt-4" href="#builders-extras">See extras and assessment limits <ArrowRight size={17} aria-hidden="true" /></a></div>
    <div>{BUILDERS_ROOMS.map((room, index) => <details key={room.title} data-disclosure="cleaning-checklist" className="builders-accordion" open={index === 0}><summary><span>{room.title}</span><ChevronDown size={20} aria-hidden="true" /></summary><div className="builders-accordion-body"><p className="text-sm text-slate-600">{room.summary}</p><ul className="builders-checklist text-sm">{room.tasks.map((task) => <li key={task}><Check size={17} aria-hidden="true" />{task}</li>)}</ul><p className="mt-5 rounded-lg bg-white p-4 text-sm text-slate-600"><strong className="text-navy-900">Check with us: </strong>{room.assessment}</p></div></details>)}</div>
  </div></section>;
}

function Extras() {
  return <section id="builders-extras" className="builders-section bg-white" aria-labelledby="builders-extras-title"><div className="builders-wrap"><span className="builders-kicker">05 / No surprises in the quote</span><h2 id="builders-extras-title">Extras, access and sensitive surfaces</h2><p className="builders-lead">Ask for everything you need in one enquiry. We separate additional cleaning from access costs, so you can see what you are agreeing to.</p>
    <div className="builders-grid builders-grid-3 mt-8">
      <article className="builders-card"><span className="builders-kicker">Separately quoted</span><h3>Additional cleaning</h3><ul className="mt-4 space-y-2 text-sm text-slate-600"><li><Link className="builders-link" to="/carpet-cleaning-london">Carpet extraction</Link> beyond vacuuming</li><li><Link className="builders-link" to="/sofa-cleaning-london">Sofa and upholstery cleaning</Link></li><li>Exterior windows, pressure washing and appliance deep cleaning: ask us to assess the work and access.</li></ul></article>
      <article className="builders-card"><span className="builders-kicker">Assess before treatment</span><h3>Residue and delicate finishes</h3><p className="mt-4 text-sm text-slate-600">Paint, plaster, silicone, adhesive and grout haze need surface-specific assessment. Tell us about natural stone, coated glass, timber, fresh paint and high areas.</p><p className="mt-4 text-sm font-semibold">We cannot guarantee removal of every mark or repair permanent damage.</p></article>
      <article className="builders-card"><span className="builders-kicker">Shown separately</span><h3>Getting to your property</h3><p className="mt-4 text-sm text-slate-600">Tell us about free parking, permits, unloading, stairs and lifts. Applicable parking and congestion costs are explained before agreement. Parking is charged at actual cost.</p><p className="mt-4 text-sm text-slate-600">Restricted hours, out-of-hours work or extra visits need agreement; they are not assumed in the starting price.</p></article>
    </div>
    <p className="mt-6 text-sm text-slate-600"><strong className="text-navy-900">Before the visit:</strong> your builders should remove tools, rubble and excess waste. Repairs, repainting and building-waste clearance are not part of the standard cleaning quote.</p>
  </div></section>;
}

function Process() {
  const steps = [
    ['Send your enquiry', 'Share the postcode, size, building work, photos and preferred date. No payment is needed to enquire.'],
    ['We assess the job', 'We review dust, residue, finishes and access. Larger or complex projects may need plans or a site visit.'],
    ['Agree a fixed quote', 'Review the cleaning list, price, access costs and timing. Additional work needs your agreement before it is charged.'],
    ['Confirm the appointment', `We email the agreed details and payment options. Your ${penceToDisplay(DEPOSIT_P)} deposit secures the booking and comes off the total.`],
    ['We clean the agreed areas', 'The team brings the products and equipment for the quoted tasks. Let us know if the site has changed since assessment.'],
    ['Check the completed work', 'We check against the agreed list. The balance is due on the cleaning day under your booking terms. Ask about a receipt and record of the work.'],
  ];
  return <section id="builders-process" className="builders-section builders-dark" aria-labelledby="builders-process-title"><div className="builders-wrap"><span className="builders-kicker">06 / From photos to final check</span><h2 id="builders-process-title">Know the work. Agree the price.<br />Then confirm your date.</h2><p className="builders-lead">One clear quotation for your property. No hourly bill to work out afterwards.</p><ol className="builders-grid builders-grid-3 builders-process">{steps.map(([title, body], index) => <li key={title}><span className="builders-process-number" aria-hidden="true">{index + 1}</span><h3>{title}</h3><p className="mt-3 text-sm">{body}</p></li>)}</ol><div className="mt-8 flex flex-wrap items-center gap-5 border-t border-white/20 pt-6"><ShieldCheck size={26} className="text-sky-200" aria-hidden="true" /><p className="text-sm">£5m public liability insurance · Please give at least 24 hours’ notice to change a confirmed appointment.</p><Link to="/terms-of-service" className="text-sm text-white underline underline-offset-4">Read booking terms</Link></div></div></section>;
}

function DiyAndResults() {
  return <>
    <section id="builders-diy" className="builders-section bg-white" aria-labelledby="builders-diy-title"><div className="builders-wrap"><span className="builders-kicker">07 / Choosing the right help</span><h2 id="builders-diy-title">Could you do the clean yourself?</h2><p className="builders-lead">For a small amount of light dust, perhaps. The decision changes when several rooms, new finishes or bonded residue need attention.</p><div className="builders-grid builders-grid-2 mt-8"><article className="builders-card"><h3>Doing it yourself</h3><p className="mt-3 text-slate-600">You control the timing and avoid a service charge. Allow time for repeated dust removal, cupboard interiors, glass and floors. Check the surface-care instructions before using a scraper or cleaning product on new materials.</p></article><article className="builders-card !bg-[#edf6fb]"><h3>Booking a professional clean</h3><p className="mt-3 text-slate-600">You agree a defined list and price, with suitable equipment supplied for that work. It can help when there is a handover to organise or you need an assessment of unfamiliar finishes. Cleaning still has limits; it cannot undo building damage.</p></article></div><p className="mt-6 text-sm text-slate-600"><strong>Before choosing any cleaner, ask:</strong> which rooms and surfaces are included, whether windows mean inside or outside, what access costs apply, how many visits are quoted, and what happens if the scope changes.</p></div></section>
    <section id="builders-results" className="builders-section builders-soft" aria-labelledby="builders-results-title"><div className="builders-wrap"><div className="builders-split"><div><span className="builders-kicker">08 / Our work</span><h2 id="builders-results-title">Room for the real results.</h2><p className="builders-lead">Genuine VVE Clean after-builders photos and videos will be added here. This space is reserved for our own work.</p><p className="mt-4 text-sm text-slate-600">No project results are pictured yet.</p></div><div className="builders-media-pair" aria-label="Genuine project media placeholders"><div className="builders-media"><div><Camera className="mx-auto mb-4" size={30} aria-hidden="true" /><strong>Before & after</strong><p className="mt-2 text-sm">Genuine project photos to follow</p></div></div><div className="builders-media"><div><FileText className="mx-auto mb-4" size={30} aria-hidden="true" /><strong>A closer look</strong><p className="mt-2 text-sm">Job details and video to follow</p></div></div></div></div></div></section>
  </>;
}

function ClientsAndAreas() {
  return <>
    <section id="builders-clients" className="builders-section bg-white" aria-labelledby="builders-clients-title"><div className="builders-wrap"><span className="builders-kicker">09 / Homes and handovers</span><h2 id="builders-clients-title">A quote that fits your project</h2><div className="builders-grid builders-grid-3 mt-8">{[
      ['Homeowners & landlords', 'Tell us when you need to move back in or prepare the property for tenants. Flag occupied rooms, furniture and personal belongings.'],
      ['Agents & property managers', 'Send the access arrangements, handover deadline and required cleaning list. Tell us what receipt or completion record you need.'],
      ['Builders, developers & businesses', 'Share plans, floor area, site rules and the stage of the work. We assess new-build units, commercial spaces and multi-visit requests individually.'],
    ].map(([title, body]) => <article key={title} className="border-t-2 border-sky-200 pt-5"><h3>{title}</h3><p className="mt-3 text-slate-600">{body}</p></article>)}</div><p className="mt-6 text-sm text-slate-600">A completion record describes the cleaning carried out. It is not an independent building certificate or a guarantee of landlord or agent acceptance.</p></div></section>
    <section id="builders-areas" className="builders-section builders-soft" aria-labelledby="builders-areas-title"><div className="builders-wrap builders-split"><div><span className="builders-kicker">10 / Local coverage</span><h2 id="builders-areas-title">East & North London.<br />Start with your postcode.</h2><p className="builders-lead">We confirm coverage, access and availability for your address before you book. These are some of the areas we already serve.</p></div><div><MapPin size={28} className="text-royal-700" aria-hidden="true" /><div className="builders-area-links">{AREAS.filter((area) => ['islington', 'hackney', 'stratford', 'walthamstow', 'stoke-newington', 'bow', 'finsbury-park', 'tottenham'].includes(area.slug)).map((area) => <Link key={area.slug} to={`/cleaning-${area.slug}`}>{area.name}</Link>)}</div><p className="text-sm text-slate-600">Not listed here? Send your postcode and we’ll check. Mention parking restrictions, permits, floors, lifts and any site sign-in arrangements with your enquiry.</p></div></div></section>
  </>;
}

function QuestionsAndQuote() {
  return <>
    <section id="builders-faq" className="builders-section bg-white" aria-labelledby="builders-faq-title"><div className="builders-wrap builders-split"><div><span className="builders-kicker">11 / Before you book</span><h2 id="builders-faq-title">The practical questions</h2><p className="builders-lead">If your project has an unusual finish or access requirement, include it in your enquiry. It is easier to plan for it before the visit.</p><a className="builders-link mt-4" href="tel:02080502233">Call 020 8050 2233</a></div><div>{BUILDERS_FAQS.map((faq) => <details className="builders-accordion" key={faq.q}><summary><span className="faq-question">{faq.q}</span><ChevronDown size={19} aria-hidden="true" /></summary><p className="faq-answer builders-accordion-body text-sm text-slate-600">{faq.a}</p></details>)}</div></div></section>
    <section id="builders-quote" className="builders-section builders-soft" aria-labelledby="builders-quote-title"><div className="builders-wrap builders-split"><div><span className="builders-kicker">12 / Ready for a quote?</span><h2 id="builders-quote-title">A few photos are a good start.</h2><p className="builders-lead">Send a view of each affected room, plus close-ups of residue and delicate surfaces. Please leave people and personal documents out of the photos.</p></div><div className="builders-card"><h3>Include these details with your photos</h3><ol className="builders-quote-list text-sm"><li><strong aria-hidden="true">01</strong><span>Postcode, property size and number of bathrooms.</span></li><li><strong aria-hidden="true">02</strong><span>What the builders did, what is left, and when the work will finish.</span></li><li><strong aria-hidden="true">03</strong><span>Rooms, windows and any extra services you want included.</span></li><li><strong aria-hidden="true">04</strong><span>Your preferred date, parking and access arrangements.</span></li></ol><div className="mt-6"><PhotoQuoteLink location="after_builders_quote" /></div><p className="mt-4 text-sm text-slate-600">Prefer to write it out? <Link to="/contact?service=after_builders" className="builders-link text-sm">Send an enquiry</Link>. We can arrange how to share photos after you contact us.</p></div></div></section>
  </>;
}

export default function AfterBuildersContent() {
  return <>
    <nav className="builders-nav" aria-label="After-builders page sections"><div className="builders-wrap"><span className="mr-2 text-xs font-bold uppercase tracking-widest text-slate-500">On this page</span>{NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</div></nav>
    <PricingGuide /><ServiceAndCost /><CleaningLevels /><CleaningChecklist /><Extras /><Process /><DiyAndResults /><ClientsAndAreas /><QuestionsAndQuote />
  </>;
}
