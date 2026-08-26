import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';
import TeamSection from '../components/TeamSection';
import { COVERAGE_SUMMARY, COVERAGE_POSTCODE_LIST } from '../data/pricing';

const principles = [
  'A written scope and clear price before work starts',
  'Direct contact with VVE Clean if plans or access details change',
  'Photos and practical notes where they help document the job',
];

// Facts only — every line here is verifiable from the pricing catalogue, the
// published coverage list or Companies House. Nothing about team size,
// tenure, headcount or credentials appears anywhere on this page, because
// none of that is confirmed. When an owner-approved photograph is available
// it replaces this card in the same grid column; no other change is needed.
const atAGlance = [
  { label: 'Services', value: 'End of tenancy, carpet, sofa & upholstery, after-builders and commercial cleaning' },
  { label: 'Coverage', value: `${COVERAGE_SUMMARY} — ${COVERAGE_POSTCODE_LIST}` },
  { label: 'Insurance', value: '£5m public liability. Certificate available on request.' },
  { label: 'Pricing', value: 'Published prices for standard services, with any extras shown before a booking is accepted' },
];

export default function AboutPage() {
  return (
    <div className="mobile-page-bottom min-h-screen bg-white lg:pb-0">
      <Navbar />
      <main id="main-content">
        <section className="navy-gradient px-4 pb-16 pt-32 text-white">
          <div className="mx-auto max-w-5xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">About VVE Clean</p>
            <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
              Straight answers, careful work and a clear booking process.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sky-50 sm:text-lg">
              VVE Clean is a London cleaning business focused on end of tenancy, carpet, upholstery, after-builders and commercial work. We keep prices and scope visible so customers know what they are requesting.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-royal-600">How we work</p>
              <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">A local team you can contact directly</h2>
              <p className="mt-5 leading-7 text-muted">
                You can call, email or message VVE Clean before booking. We ask for the service, property details and preferred date, then confirm availability separately. The £30 booking request deposit is deducted from the final total.
              </p>
              <ul className="mt-7 space-y-4">
                {principles.map((item) => (
                  <li key={item} className="flex gap-3 text-ink">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-royal-500" size={20} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-7 sm:p-8">
              <h2 className="font-display text-xl font-bold text-navy-900">VVE Clean at a glance</h2>
              <dl className="mt-5 space-y-4">
                {atAGlance.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-royal-600">{item.label}</dt>
                    <dd className="mt-1 text-sm leading-6 text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                to="/pricing"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-royal-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-royal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
              >
                See all prices
              </Link>
            </div>
          </div>
        </section>

        <TeamSection />

        <section className="px-4 pb-16">
          <div className="mx-auto max-w-5xl rounded-3xl border border-line bg-surface p-7 sm:p-10">
            <h2 className="font-display text-2xl font-bold text-navy-900">Checked and reviewed independently</h2>
            <p className="mt-4 leading-7 text-muted">
              VVE Limited is a Checkatrade member. Checkatrade verifies its members
              independently and publishes customer reviews that VVE Clean cannot edit,
              so you can check our record for yourself rather than taking our word for it.
            </p>
            <a
              href="https://www.checkatrade.com/trades/vvelimited"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-royal-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-royal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            >
              See our Checkatrade profile
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </section>

        <section className="bg-surface px-4 py-16">
          <div className="mx-auto max-w-5xl rounded-3xl border border-line bg-white p-7 sm:p-10">
            <ShieldCheck className="text-royal-500" size={30} aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-bold text-navy-900">Company details</h2>
            <p className="mt-4 leading-7 text-muted">VVE Limited trading as VVE Clean. Registered in England and Wales, company number 17234391. Registered office: 23-25 Queensway, London W2 4QP. Cleaning services are delivered at customer premises.</p>
          </div>
        </section>
      </main>
      <Footer />
      <MobileStickyFooter />
    </div>
  );
}
