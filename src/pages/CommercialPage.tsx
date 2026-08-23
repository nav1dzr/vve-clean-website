import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  FileCheck2,
  KeyRound,
  Mail,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileActionDock from '../components/MobileActionDock';
import {
  COMMERCIAL_REGULAR_HOURLY_P,
  COMMERCIAL_REGULAR_MIN_CHARGE_P,
  COMMERCIAL_ONCEOFF_HOURLY_P,
  COMMERCIAL_ONCEOFF_MIN_CHARGE_P,
  COMMERCIAL_SHOP_CAFE_FROM_P,
  COMMERCIAL_COMMUNAL_FROM_P,
  COMMERCIAL_EOL_FROM_P,
  COMMERCIAL_AFTER_BUILDERS_FROM_P,
} from '../data/pricing';

const WA_COMMERCIAL =
  'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20commercial%20site%20visit%20please.%20Address%3A%20';
const EMAIL = 'mailto:contact@vveclean.co.uk';
const price = (pence: number) => `£${pence / 100}`;

const SECTORS = [
  {
    icon: Building2,
    title: 'Offices & studios',
    body: 'Daily or weekly cleaning planned around your working hours, with the same team learning the site.',
    detail: 'Desks · kitchens · washrooms · floors',
  },
  {
    icon: Coffee,
    title: 'Shops, cafés & restaurants',
    body: 'Presentation-focused cleaning before opening, covering customer areas, glass, floors and washrooms.',
    detail: 'Front of house · glass · touchpoints',
  },
  {
    icon: KeyRound,
    title: 'Communal areas',
    body: 'Scheduled care for residential blocks, landlords and managing agents with one simple monthly invoice.',
    detail: 'Hallways · stairs · lifts · bin stores',
  },
  {
    icon: ShoppingBag,
    title: 'End-of-lease commercial',
    body: 'A complete handover clean for offices and retail units, coordinated as one accountable service.',
    detail: 'Deep clean · carpets · windows',
  },
];

const INCLUDED = [
  'Same cleaner or team on regular visits',
  'Out-of-hours and keyholding available',
  'All cleaning equipment and products supplied',
  'RAMS, method statements and insurance documents on request',
  'Monthly invoicing with 14-day payment terms',
  'No long lock-ins — 30 days’ notice',
];

const RATES = [
  { label: 'Regular contract cleaning', price: `from ${price(COMMERCIAL_REGULAR_HOURLY_P)}/cleaner-hour`, note: `Minimum ${price(COMMERCIAL_REGULAR_MIN_CHARGE_P)} per visit` },
  { label: 'One-off commercial deep clean', price: `from ${price(COMMERCIAL_ONCEOFF_HOURLY_P)}/cleaner-hour`, note: `Minimum ${price(COMMERCIAL_ONCEOFF_MIN_CHARGE_P)}` },
  { label: 'Shop or café presentation clean', price: `from ${price(COMMERCIAL_SHOP_CAFE_FROM_P)}/visit` },
  { label: 'Communal areas', price: `from ${price(COMMERCIAL_COMMUNAL_FROM_P)}/visit` },
  { label: 'End-of-lease commercial clean', price: `from ${price(COMMERCIAL_EOL_FROM_P)}` },
  { label: 'Commercial after-builders clean', price: `from ${price(COMMERCIAL_AFTER_BUILDERS_FROM_P)}` },
];

const STEPS = [
  { icon: MapPin, step: '01', title: 'Send the address', body: 'Tell us about the property, access and the cleaning frequency you need.' },
  { icon: ClipboardCheck, step: '02', title: 'Free site visit', body: 'We inspect the space and agree the exact cleaning specification with you.' },
  { icon: FileCheck2, step: '03', title: 'Fixed written quote', body: 'You receive a clear price and schedule before any work is agreed.' },
];

const FAQS = [
  {
    q: 'Do you have insurance and RAMS?',
    a: 'Yes — £5m public liability as standard. All staff are DBS-checked. We supply RAMS, method statements and insurance certificates before any contract starts, at no extra cost.',
  },
  {
    q: 'Can you clean outside opening hours?',
    a: 'Yes. Early mornings, evenings and weekends are available. Keyholding and alarm management can be arranged for regular clients.',
  },
  {
    q: 'How does billing work?',
    a: 'One monthly invoice with 14-day payment terms. No deposits are required for contract clients.',
  },
  {
    q: 'Is there a minimum contract length?',
    a: 'There are no long lock-ins. You can cancel with 30 days’ notice.',
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Service',
      name: 'Commercial cleaning',
      description: 'Contract cleaning for offices, shops, cafés and retail units across East and North London.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean' },
      areaServed: 'East and North London',
    },
    {
      '@type': 'Service',
      name: 'Communal area cleaning',
      description: 'Scheduled cleaning of communal hallways, stairwells, lifts and bin stores for residential blocks and landlords.',
      provider: { '@type': 'LocalBusiness', name: 'VVE Clean' },
      areaServed: 'East and North London',
    },
  ],
});

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-none" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function CommercialPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA }} />
      <div className="min-h-screen bg-[#fafbfd] mobile-page-bottom lg:pb-0">
        <Navbar />
        <main id="main-content">
          <section className="relative overflow-hidden bg-navy-950 px-4 pb-20 pt-28">
            <div aria-hidden="true" className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.06fr_0.94fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Commercial & communal cleaning</p>
                <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                  A cleaning plan built around <span className="text-sky-300">your site.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  Offices, shops, cafés and residential blocks across East & North London. Start with a free site visit, then receive a fixed written quote and clear cleaning specification.
                </p>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2"><ShieldCheck size={18} className="text-sky-300" /> £5m public liability</span>
                  <span className="inline-flex items-center gap-2"><Clock3 size={18} className="text-sky-300" /> Out-of-hours available</span>
                  <span className="inline-flex items-center gap-2"><FileCheck2 size={18} className="text-sky-300" /> RAMS available</span>
                </div>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <a href={WA_COMMERCIAL} target="_blank" rel="noopener noreferrer" className="btn-whatsapp inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    <WhatsAppIcon /> Book a free site visit
                  </a>
                  <a href={EMAIL} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3.5 font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    <Mail size={19} /> Email your requirements
                  </a>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-7">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">Your cleaning brief</p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-white">Clear before we start</h2>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400 text-navy-950"><ClipboardCheck size={25} /></span>
                </div>
                <div className="mt-5 space-y-3">
                  {['Areas and tasks agreed', 'Visit frequency confirmed', 'Access arrangements recorded', 'Fixed price supplied in writing'].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl bg-navy-950/45 px-4 py-3 text-sm font-semibold text-white">
                      <CheckCircle2 size={18} className="flex-none text-sky-300" /> {item}
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs leading-relaxed text-slate-400">One agreed specification gives your team and ours the same standard to work from.</p>
              </div>
            </div>
          </section>

          <section className="border-b border-slate-200 bg-white px-4 py-6">
            <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-slate-200 text-center sm:grid-cols-4">
              {['Free site visit', 'Fixed written quote', 'Monthly invoicing', 'East & North London'].map((item) => (
                <p key={item} className="px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-navy-800 sm:text-sm">{item}</p>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Who we clean for</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">The right plan for the way your building is used.</h2>
              <p className="mt-4 text-slate-600">Choose the closest starting point. The final specification is tailored during the site visit.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {SECTORS.map(({ icon: Icon, title, body, detail }, index) => (
                <article key={title} className={`group rounded-[1.5rem] border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${index === 0 ? 'border-navy-800 bg-navy-950 text-white md:row-span-2 md:flex md:flex-col md:justify-between' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-6">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${index === 0 ? 'bg-sky-400 text-navy-950' : 'bg-sky-50 text-sky-600'}`}><Icon size={24} /></span>
                    <ArrowRight size={20} className={index === 0 ? 'text-sky-300' : 'text-slate-300'} />
                  </div>
                  <div className={index === 0 ? 'mt-16' : 'mt-6'}>
                    <h3 className={`font-display text-xl font-bold ${index === 0 ? 'text-white md:text-3xl' : 'text-navy-900'}`}>{title}</h3>
                    <p className={`mt-3 leading-relaxed ${index === 0 ? 'text-slate-300' : 'text-slate-600'}`}>{body}</p>
                    <p className={`mt-5 text-xs font-bold uppercase tracking-[0.12em] ${index === 0 ? 'text-sky-300' : 'text-sky-600'}`}>{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-surface px-4 py-20">
            <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-navy-950/5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-navy-950 p-8 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Every regular contract</p>
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-white">A documented service, not a vague promise.</h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">The schedule, tasks, access and price are agreed before the first clean so there is a clear standard to review.</p>
                <Link to="/commercial-carpet-cleaning-london" className="mt-7 inline-flex min-h-[44px] items-center gap-2 font-bold text-sky-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Commercial carpet cleaning <ArrowRight size={18} />
                </Link>
              </div>
              <ul className="grid gap-x-8 gap-y-5 p-8 sm:grid-cols-2 sm:p-10">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 size={20} className="mt-0.5 flex-none text-sky-600" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-20">
            <div className="grid items-start gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="lg:sticky lg:top-28">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Guide pricing</p>
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">A useful starting point. Your site receives a fixed quote.</h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">Rates depend on size, frequency, access and the agreed task list. We confirm the complete price in writing before work starts.</p>
              </div>
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-lg shadow-navy-950/5">
                {RATES.map((row) => (
                  <div key={row.label} className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-navy-900">{row.label}</p>
                      {row.note && <p className="mt-1 text-xs text-slate-500">{row.note}</p>}
                    </div>
                    <p className="font-mono text-sm font-bold tabular-nums text-sky-700">{row.price}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-white px-4 py-20">
            <div className="mx-auto max-w-6xl">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">How it works</p>
                <h2 className="mt-3 font-display text-3xl font-bold text-navy-900 md:text-4xl">From enquiry to an agreed cleaning plan.</h2>
              </div>
              <ol className="mt-10 grid gap-5 md:grid-cols-3">
                {STEPS.map(({ icon: Icon, step, title, body }) => (
                  <li key={step} className="rounded-2xl border border-slate-200 bg-surface p-6">
                    <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-950 text-sky-300"><Icon size={21} /></span><span className="font-mono text-sm font-bold text-sky-600">{step}</span></div>
                    <h3 className="mt-5 font-display text-xl font-bold text-navy-900">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="mx-auto max-w-4xl px-4 py-20">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Questions</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-navy-900">Commercial cleaning FAQs</h2>
            </div>
            <ul className="faq-list mt-10">
              {FAQS.map((faq) => (
                <li key={faq.q} className="faq-item">
                  <details><summary className="faq-summary"><span className="faq-question">{faq.q}</span><span className="faq-icon" aria-hidden="true">+</span></summary><div className="faq-answer"><p>{faq.a}</p></div></details>
                </li>
              ))}
            </ul>
          </section>

          <section className="navy-gradient px-4 py-20">
            <div className="mx-auto max-w-3xl text-center">
              <Sparkles size={28} className="mx-auto text-sky-300" />
              <h2 className="mt-4 font-display text-3xl font-bold text-white md:text-4xl">Start with a free site visit.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-300">Send the address and a short description of the space. We will arrange the next suitable time to assess it.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a href={WA_COMMERCIAL} target="_blank" rel="noopener noreferrer" className="btn-whatsapp inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><WhatsAppIcon /> WhatsApp your address</a>
                <a href={EMAIL} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Mail size={19} /> Email your requirements</a>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
      <MobileActionDock variant="commercial" analyticsLocation="commercial_page_dock" waLink={WA_COMMERCIAL} />
    </>
  );
}
