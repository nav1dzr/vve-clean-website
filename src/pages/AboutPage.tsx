import { Link } from 'react-router-dom';
import { Shield, CheckCircle2, Clock, MapPin, Users, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { EOT_GUARANTEE_HOURS, COVERAGE_POSTCODE_LIST } from '../data/pricing';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

const VALUES = [
  {
    icon: Shield,
    title: 'Properly insured and vetted',
    body: 'Every cleaner is DBS-checked, and we carry £5m public liability insurance on every job. Certificates are available on request before you book.',
  },
  {
    icon: CheckCircle2,
    title: 'Fixed prices, agreed upfront',
    body: 'You see the price before you book, and it stays the price — for normal condition properties based on the details you give us. No surprise add-ons on the day.',
  },
  {
    icon: Clock,
    title: 'We put it right',
    body: `On our Complete end of tenancy clean, if your agent or landlord flags a cleaning issue within ${EOT_GUARANTEE_HOURS} hours, we come back and re-clean it — free of charge.`,
  },
  {
    icon: MapPin,
    title: 'Rooted in East & North London',
    body: `We cover ${COVERAGE_POSTCODE_LIST}. It's the area we know, and where we can turn a booking around quickly.`,
  },
];

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  mainEntity: {
    '@type': 'LocalBusiness',
    name: 'VVE Clean',
    url: 'https://www.vveclean.co.uk',
    telephone: '+442080502233',
    email: 'contact@vveclean.co.uk',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '23-25 Queensway',
      addressLocality: 'London',
      postalCode: 'W2 4QP',
      addressCountry: 'GB',
    },
  },
});

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#fafbfd] pb-[56px] lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA }} />
      <Navbar />
      <main id="main-content">

        {/* Hero */}
        <div className="navy-gradient pt-32 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Our Story</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              About VVE Clean
            </h1>
            <p className="text-silver-200 text-base sm:text-lg max-w-xl mx-auto">
              A cleaning company built by three friends who'd already spent years doing this job for other people.
            </p>
          </div>
        </div>

        {/* Story */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mb-6">How VVE Clean started</h2>
          <div className="space-y-5 text-silver-700 text-base leading-relaxed">
            <p>
              Before VVE Clean existed, the three of us worked for different cleaning companies around London —
              different teams, different standards, different ways of doing things. We each learned a lot doing
              that work, and we each ran into the same frustrations: jobs quoted one way and charged another,
              corners cut when nobody was watching, and cleaners sent out without the right kit for the job in
              front of them.
            </p>
            <p>
              Somewhere along the way, the three of us got talking properly for the first time — comparing notes
              on what worked, what didn't, and what we'd do differently if it were up to us. Eventually that
              conversation turned into a decision: stop cleaning on someone else's terms, and build a company
              that did it the way we actually believed it should be done.
            </p>
            <p>
              That's VVE Clean. It's still the three of us, still hands-on, still answering the phone and the
              WhatsApp messages ourselves. We're building it properly and carefully — starting with end of
              tenancy cleans, carpets, upholstery and commercial and outdoor work, and growing the team as the
              work grows.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="bg-white border-y border-silver-200 py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mb-10 text-center">
              What we stand for
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {VALUES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-4 bg-silver-50 border border-silver-200 rounded-2xl p-6">
                  <div className="w-11 h-11 rounded-xl bg-royal-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="text-royal-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 text-base mb-1.5">{title}</h3>
                    <p className="text-silver-600 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team teaser */}
        <section className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-royal-500/10 flex items-center justify-center mx-auto mb-5">
            <Users className="text-royal-600" size={24} />
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mb-3">
            Meet the people behind VVE Clean
          </h2>
          <p className="text-silver-600 text-base mb-7 max-w-xl mx-auto">
            We're a small, hands-on team — get to know who you'll actually be booking.
          </p>
          <Link
            to="/team"
            className="inline-flex items-center gap-2 min-h-[44px] bg-royal-500 hover:bg-royal-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-md"
          >
            Meet our team
            <ArrowRight size={16} />
          </Link>
        </section>

        {/* CTA */}
        <section className="navy-gradient py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
              Got a question before you book?
            </h2>
            <p className="text-silver-300 mb-7 text-sm sm:text-base">
              Message us on WhatsApp or get in touch — we usually reply within the hour.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-royal-500 hover:bg-royal-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-md"
              >
                Contact us
              </Link>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] btn-whatsapp font-semibold px-6 py-3 rounded-lg transition-all duration-200"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </section>

      </main>
      <Footer />

      {/* Mobile sticky bar — same lightweight Call/WhatsApp pattern as the
          Terms and Privacy pages, rather than the booking-flow sticky footer. */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-silver-200 shadow-xl"
        style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}>
        <div className="grid grid-cols-2 divide-x divide-silver-200">
          <a href="tel:02080502233"
            className="flex items-center justify-center gap-2 py-4 font-bold text-navy-900 text-sm active:bg-silver-100 transition-colors">
            Call us
          </a>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 font-bold text-white text-sm btn-whatsapp transition-colors">
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
