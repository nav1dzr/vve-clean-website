import AfterBuildersEnquiry from './AfterBuildersEnquiry';
import AfterBuildersPhoto from './AfterBuildersPhoto';
import { ArrowRight, Camera, Check, ChevronDown, ClipboardCheck, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BUILDERS_FAQS, BUILDERS_BUDGET_GUIDE, BUILDERS_LEVELS, formatBuildersRange, BUILDERS_ROOMS, BUILDERS_WHATSAPP } from '../data/afterBuildersContent';
import { AFTER_BUILDERS_START_FROM_P, DEPOSIT_P, PRESSURE_WASHING_FROM_P, GARDEN_SERVICES_FROM_P, GARDEN_SERVICES_MIN_P, WINDOW_CLEANING_FROM_P, WINDOW_CLEANING_MIN_P, penceToDisplay } from '../data/pricing';
import { AREAS } from '../data/areas';
import PriceTaxNote from './PriceTaxNote';

const NAV = [
  ['builders-prices', 'Prices'], ['builders-checklist', 'Cleaning checklist'],
  ['builders-extras', 'Optional extras'], ['builders-process', 'How it works'],
  ['builders-faq', 'Questions'], ['builders-quote', 'Get a quote'],
];

function PhotoQuoteLink({ children = 'Send photos for a fixed quote', location }: { children?: React.ReactNode; location: string }) {
  return <a href={BUILDERS_WHATSAPP} target="_blank" rel="noopener noreferrer" className="builders-button" data-track-location={location}><Camera size={19} aria-hidden="true" />{children}<ArrowRight size={18} aria-hidden="true" /></a>;
}

export function AfterBuildersQuoteCard() {
  const flat = BUILDERS_BUDGET_GUIDE[0];
  return <aside className="builders-quote-card" aria-label="After-builders budget at a glance">
    <div className="builders-quote-card-top">
      <div className="builders-card-heading"><span className="builders-kicker">Plan the clean</span><ClipboardCheck size={26} aria-hidden="true" /></div>
      <p className="builders-card-label">{flat.label} · standard clean</p>
      <p className="builders-card-range">{formatBuildersRange(flat.standard)}</p>
      <p className="builders-card-caption">Indicative budget. Your rooms, size and condition determine the fixed quote.</p>
    </div>
    <div className="builders-quote-card-bottom"><span>No VAT added</span><a className="builders-link" href="#builders-prices">Compare budgets <ArrowRight size={16} aria-hidden="true" /></a></div>
  </aside>;
}

function PricingGuide() {
  return <section id="builders-prices" className="builders-section bg-white" aria-labelledby="builders-prices-title"><div className="builders-wrap">
    <span className="builders-kicker">Price guide</span><h2 id="builders-prices-title">A clearer idea of the budget.</h2>
    <p className="builders-lead">Start with standard for a post-renovation clean. These are planning ranges, not fixed packages or a checkout total. We assess the work and send one written quote before you book.</p>
    <div className="builders-budget-panel">
      <table className="builders-price-table" role="table"><caption className="sr-only">Indicative after-builders cleaning budgets in pounds. Final scope and price are assessed for each property.</caption>
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Your property</th>{BUILDERS_LEVELS.map(item => <th role="columnheader" key={item.key} scope="col" data-level-column={item.key}>{item.label}{item.key === 'standard' && <span className="builders-table-hint">Post-renovation guide</span>}</th>)}</tr></thead>
        <tbody role="rowgroup">{BUILDERS_BUDGET_GUIDE.map(row => <tr role="row" key={row.key} data-price-key={row.key}><th role="rowheader" scope="row">{row.label}<small>{row.note}</small></th>{BUILDERS_LEVELS.map(item => {
          const [minimum, maximum] = formatBuildersRange(row[item.key]).split('–');
          return <td role="cell" key={item.key} data-level-column={item.key}><span className="builders-mobile-level" aria-hidden="true">{item.key === 'light' ? 'Light clean' : item.label}</span><span className="builders-price-range"><span>{minimum}–</span><wbr /><span>{maximum}</span></span></td>;
        })}</tr>)}</tbody>
      </table>
      <div className="builders-budget-definitions">{BUILDERS_LEVELS.map(item => <div key={item.key} data-level-column={item.key}><strong>{item.label}</strong><p>{item.description}</p></div>)}</div>
      <div className="builders-table-foot"><PriceTaxNote /><p>Large or unusual layouts, extensive glazing and difficult residue need an individual assessment. An additional visit is quoted separately.</p></div>
    </div>
    <div className="builders-quote-strip"><p><strong>Your final quote lists the agreed work and known extras.</strong><br />Parking is charged at actual cost. We explain any congestion charge or unresolved access cost before you agree.</p><a className="builders-button builders-button-primary" href="#builders-quote">Get my cleaning quote <ArrowRight size={18} aria-hidden="true" /></a></div>
    <details data-disclosure="price-details" className="builders-accordion builders-price-detail"><summary><span>Only one area, or not sure which clean you need?</span><ChevronDown size={20} aria-hidden="true" /></summary><div className="builders-accordion-body"><p>A small renovation or one main area starts from {penceToDisplay(AFTER_BUILDERS_START_FROM_P)} after assessment. This is a limited-area guide, not a whole-property price. Studios, extensions, shops and unusual layouts are quoted to the work required.</p><p className="mt-3">Send the affected rooms, approximate size and a few photos. We check dust, finishes, glazing, storage and access. “Not sure” is fine in the enquiry.</p></div></details>
  </div></section>;
}

function CleaningChecklist() {
  return <section id="builders-checklist" className="builders-section builders-soft" aria-labelledby="builders-checklist-title"><div className="builders-wrap builders-split">
    <div><span className="builders-kicker">The cleaning list</span><h2 id="builders-checklist-title">Rooms first. Everyday details included.</h2><p className="builders-lead">For the rooms we agree to clean, we plan dust removal, reachable surfaces, fittings and suitable floor cleaning together. You do not need to add every switch or skirting board separately.</p><div className="builders-note mt-6"><p className="text-sm"><strong>Your written quote defines the work.</strong> Empty cupboard interiors and internal glass are agreed explicitly, including quantity and access. The list below describes tasks we can assess; it is not an unlimited package.</p></div><a className="builders-link mt-4" href="#builders-extras">See extras and assessment limits <ArrowRight size={17} aria-hidden="true" /></a></div>
    <div>{BUILDERS_ROOMS.map((room, index) => <details key={room.title} data-disclosure="cleaning-checklist" className="builders-accordion" open={index === 0}><summary><span>{room.title}</span><ChevronDown size={20} aria-hidden="true" /></summary><div className="builders-accordion-body"><p className="text-sm text-slate-600">{room.summary}</p><ul className="builders-checklist text-sm">{room.tasks.map((task) => <li key={task}><Check size={17} aria-hidden="true" />{task}</li>)}</ul><p className="mt-5 rounded-lg bg-white p-4 text-sm text-slate-600"><strong className="text-navy-900">Check with us: </strong>{room.assessment}</p></div></details>)}</div>
  </div></section>;
}

function Extras() {
  const items = [
    { name: 'Driveway, patio & paths', service: 'Pressure washing', price: PRESSURE_WASHING_FROM_P, detail: 'Send approximate area and photos. Surface type, condition, drainage and access determine the quote.' },
    { name: 'Garden tidy & maintenance', service: 'Garden services', price: GARDEN_SERVICES_FROM_P, detail: `Tell us what needs cutting back, tidying or clearing. Minimum standalone visit ${penceToDisplay(GARDEN_SERVICES_MIN_P)}. Waste removal must be agreed separately.` },
    { name: 'Exterior window cleaning', service: 'Windows', price: WINDOW_CLEANING_FROM_P, detail: `Ground and first-floor reach, subject to safe access. Minimum standalone visit ${penceToDisplay(WINDOW_CLEANING_MIN_P)}. Send quantities and photos; this is not a per-window price.` },
  ];
  return <section id="builders-extras" className="builders-section bg-white" aria-labelledby="builders-extras-title"><div className="builders-wrap">
    <span className="builders-kicker">Optional extras</span><h2 id="builders-extras-title">Inside finished.<br />Outside needs attention too?</h2><p className="builders-lead">Include extra services in the same enquiry. We’ll price the work together and list each extra clearly, so you can decide what to go ahead with.</p>
    <div className="builders-extras-box">{items.map(item => <article className="builders-extra-row" key={item.service}><div><span className="builders-extra-type">{item.service}</span><h3>{item.name}</h3><p>{item.detail}</p></div><p className="builders-extra-price"><span>From</span> {penceToDisplay(item.price)}</p></article>)}<div className="builders-extras-foot">Existing VVE service starting prices, not fixed add-on fees or a guaranteed combined discount. Final scope and any applicable access costs are agreed in your quote. No VAT added.</div></div>
    <div className="builders-extra-options"><div><h3>Other work to include</h3><p><Link to="/carpet-cleaning-london">Carpet extraction</Link>, <Link to="/sofa-cleaning-london">sofa cleaning</Link>, used-appliance deep cleaning or a return visit. Select what you need; we’ll confirm the quantity and price.</p></div><a className="builders-button builders-button-primary" href="#builders-quote">Include extras in my quote <ArrowRight size={18} aria-hidden="true" /></a></div>
    <details data-disclosure="price-details" className="builders-accordion builders-price-detail"><summary><span>Residue, access and work that needs separate agreement</span><ChevronDown size={20} aria-hidden="true" /></summary><div className="builders-accordion-body builders-grid builders-grid-2"><div><h3>New finishes and stubborn marks</h3><p className="mt-3">Paint, plaster, grout haze, silicone and adhesive need surface-specific assessment. We cannot guarantee removal of every mark or repair permanent damage. Tell us about natural stone, coated glass, timber and fresh paint.</p></div><div><h3>Prepare the site for cleaning</h3><p className="mt-3">Your builders should remove tools, rubble and excess waste. Building-waste clearance and repairs are not part of the cleaning quote. Flag stairs, lifts, parking, high areas, restricted hours and returning trades before we agree the visit.</p></div></div></details>
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
  return <section id="builders-process" className="builders-section builders-dark" aria-labelledby="builders-process-title"><div className="builders-wrap"><span className="builders-kicker">From photos to final check</span><h2 id="builders-process-title">Know the work. Agree the price.<br />Then confirm your date.</h2><p className="builders-lead">One clear quotation for your property. No hourly bill to work out afterwards.</p><ol className="builders-grid builders-grid-3 builders-process">{steps.map(([title, body], index) => <li key={title}><span className="builders-process-number" aria-hidden="true">{index + 1}</span><h3>{title}</h3><p className="mt-3 text-sm">{body}</p></li>)}</ol><div className="mt-8 flex flex-wrap items-center gap-5 border-t border-white/20 pt-6"><ShieldCheck size={26} className="text-sky-200" aria-hidden="true" /><p className="text-sm">£5m public liability insurance · Please give at least 24 hours’ notice to change a confirmed appointment.</p><Link to="/terms-of-service" className="text-sm text-white underline underline-offset-4">Read booking terms</Link></div></div></section>;
}

function ResultsNote() {
  return <section id="builders-results" className="builders-section builders-results" aria-labelledby="builders-results-title"><div className="builders-wrap"><div className="builders-results-heading"><div><span className="builders-kicker">The work, in pictures</span><h2 id="builders-results-title">A closer look at the clean.</h2><p className="builders-lead">After-builders project photos will be added here. Our gallery already shows genuine work from other cleaning services.</p></div><Link className="builders-link" to="/gallery">Visit our cleaning gallery <ArrowRight size={16} aria-hidden="true" /></Link></div><div className="builders-photo-pair"><AfterBuildersPhoto slot="before" /><AfterBuildersPhoto slot="after" /></div></div></section>;
}

function ClientsAndAreas() {
  return <>
    <section id="builders-clients" className="builders-section bg-white" aria-labelledby="builders-clients-title"><div className="builders-wrap"><span className="builders-kicker">Homes and handovers</span><h2 id="builders-clients-title">A quote that fits your project</h2><div className="builders-grid builders-grid-3 mt-8">{[
      ['Homeowners & landlords', 'Tell us when you need to move back in or prepare the property for tenants. Flag occupied rooms, furniture and personal belongings.'],
      ['Agents & property managers', 'Send the access arrangements, handover deadline and required cleaning list. Tell us what receipt or completion record you need.'],
      ['Builders, developers & businesses', 'Share plans, floor area, site rules and the stage of the work. We assess new-build units, commercial spaces and multi-visit requests individually.'],
    ].map(([title, body]) => <article key={title} className="border-t-2 border-sky-200 pt-5"><h3>{title}</h3><p className="mt-3 text-slate-600">{body}</p></article>)}</div><p className="mt-6 text-sm text-slate-600">A completion record describes the cleaning carried out. It is not an independent building certificate or a guarantee of landlord or agent acceptance.</p></div></section>
    <section id="builders-areas" className="builders-section builders-soft" aria-labelledby="builders-areas-title"><div className="builders-wrap builders-split"><div><span className="builders-kicker">Local coverage</span><h2 id="builders-areas-title">East & North London.<br />Start with your postcode.</h2><p className="builders-lead">We confirm coverage, access and availability for your address before you book. These are some of the areas we already serve.</p></div><div><MapPin size={28} className="text-royal-700" aria-hidden="true" /><div className="builders-area-links">{AREAS.filter((area) => ['islington', 'hackney', 'stratford', 'walthamstow', 'stoke-newington', 'bow', 'finsbury-park', 'tottenham'].includes(area.slug)).map((area) => <Link key={area.slug} to={`/cleaning-${area.slug}`}>{area.name}</Link>)}</div><p className="text-sm text-slate-600">Not listed here? Send your postcode and we’ll check. Mention parking restrictions, permits, floors, lifts and any site sign-in arrangements with your enquiry.</p></div></div></section>
  </>;
}

function QuestionsAndQuote() {
  return <>
    <section id="builders-faq" className="builders-section bg-white" aria-labelledby="builders-faq-title"><div className="builders-wrap builders-split"><div><span className="builders-kicker">Before you book</span><h2 id="builders-faq-title">The practical questions</h2><p className="builders-lead">If your project has an unusual finish or access requirement, include it in your enquiry. It is easier to plan for it before the visit.</p><a className="builders-link mt-4" href="tel:02080502233">Call 020 8050 2233</a></div><div>{BUILDERS_FAQS.map((faq) => <details className="builders-accordion" key={faq.q}><summary><span className="faq-question">{faq.q}</span><ChevronDown size={19} aria-hidden="true" /></summary><p className="faq-answer builders-accordion-body text-sm text-slate-600">{faq.a}</p></details>)}</div></div></section>
    <section id="builders-quote" className="builders-section builders-soft" aria-labelledby="builders-quote-title"><div className="builders-wrap builders-enquiry-layout"><div><span className="builders-kicker">Your project</span><h2 id="builders-quote-title">Tell us what needs cleaning.</h2><p className="builders-lead">A few choices help us understand the job. You can leave anything you’re unsure about and send photos later.</p><div className="builders-note mt-6"><strong>A quote request, not a booking.</strong><p className="mt-2 text-sm">We’ll review the details and agree the work, price and date with you before requesting the {penceToDisplay(DEPOSIT_P)} deposit.</p></div><div className="mt-5"><PhotoQuoteLink location="after_builders_enquiry_photos" children="Send photos on WhatsApp" /><p className="mt-3 text-sm text-slate-600">Send views of the affected rooms and close-ups of residue. Leave people and personal documents out of photos.</p></div></div><AfterBuildersEnquiry /></div></section>
  </>;
}

export default function AfterBuildersContent() {
  return <>
    <nav className="builders-nav" aria-label="After-builders page sections"><div className="builders-wrap"><span className="mr-2 text-xs font-bold uppercase tracking-widest text-slate-500">On this page</span>{NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</div></nav>
    <PricingGuide /><ResultsNote /><CleaningChecklist /><Extras /><Process /><ClientsAndAreas /><QuestionsAndQuote />
  </>;
}
