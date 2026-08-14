import { Link } from 'react-router-dom';
import { Handshake, Tag, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TrustPageMobileBar from '../components/TrustPageMobileBar';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { CHECKATRADE_URL, CHECKATRADE_LABEL } from '../data/contactDetails';
import { usePageMeta } from '../hooks/usePageMeta';

const WA_TEXT = "Hi VVE Clean! I'd like to know more about you.";

const VALUES = [
  {
    icon: Handshake,
    title: 'Shared standards',
    body: 'Three people, one clear scope, one way of communicating with customers — agreed together, not left to chance.',
  },
  {
    icon: Tag,
    title: 'Fair, fixed pricing',
    body: 'The price you agree is the price you pay, for a property in normal condition. No surprises on the day.',
  },
  {
    icon: ShieldCheck,
    title: 'Backed by a guarantee',
    body: `Every Complete end of tenancy clean is covered by our ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee.`,
  },
  {
    icon: CheckCircle2,
    title: 'Vetted & insured team',
    body: 'Every cleaner is DBS-checked and we carry £5m public liability insurance as standard.',
  },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About VVE Clean',
  url: 'https://www.vveclean.co.uk/about',
  mainEntity: {
    '@type': 'Organization',
    name: 'VVE Clean',
    url: 'https://www.vveclean.co.uk',
    sameAs: [CHECKATRADE_URL],
  },
};

export default function AboutPage() {
  usePageMeta(
    'About Us | VVE Clean London',
    'VVE Clean was started by three friends who brought experience from different cleaning companies together to build a fairer, more accountable team.',
    '/about',
  );

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-[56px] lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <Navbar />
      <main id="main-content">

      {/* Hero */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Our Story</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Three friends, one accountable team
          </h1>
          <p className="text-silver-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            VVE Clean is built and run as a team, with shared standards every member is accountable to.
          </p>
        </div>
      </div>

      {/* Story */}
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="bg-white rounded-2xl border border-silver-200 shadow-sm p-6 md:p-10">
          <div className="space-y-5 text-silver-700 text-base leading-relaxed">
            <p>
              VVE Clean began with three friends who had each worked for different cleaning companies
              across London.
            </p>
            <p>
              Between them, they brought different experience, different strengths and different ideas
              about how a cleaning company should run. Rather than go their separate ways, they chose to
              build something together — a shared set of standards around clear scope, clear communication
              and real accountability, agreed between the three of them from day one.
            </p>
            <p>
              That's the company VVE Clean is today: a real team with shared standards. Fixed, honest
              pricing agreed before work begins. A team that turns up and finishes the job properly. And
              real accountability if something isn't right — a guarantee we stand behind, backed by an
              independently vetted profile you can check for yourself.
            </p>
            <p>
              Every cleaner working under the VVE Clean name is DBS-checked and covered by £5m public
              liability insurance, every Complete end of tenancy clean carries our{' '}
              {EOT_GUARANTEE_HOURS}-hour re-clean guarantee, and every price is agreed up front — no
              surprises on the day.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mt-10">
          <h2 className="font-display text-2xl font-bold text-navy-900 text-center mb-8">
            What we believe
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-silver-200 shadow-sm p-6 card-hover"
              >
                <div className="w-10 h-10 rounded-lg bg-royal-500/10 flex items-center justify-center mb-4">
                  <Icon className="text-royal-600" size={20} aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-bold text-navy-900 mb-1.5">{title}</h3>
                <p className="text-silver-600 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Independent proof */}
        <div className="mt-8 bg-white rounded-2xl border border-silver-200 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900 mb-1">Don't just take our word for it</h2>
            <p className="text-silver-600 text-sm">
              VVE Limited is independently vetted and reviewed on Checkatrade.
            </p>
          </div>
          <a
            href={CHECKATRADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 flex-shrink-0 bg-navy-950 hover:bg-navy-800 text-white font-bold px-5 py-3 min-h-[44px] rounded-full transition-all duration-300 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950 w-full sm:w-auto"
          >
            {CHECKATRADE_LABEL}
            <ExternalLink size={15} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center bg-navy-950 rounded-2xl px-6 py-10">
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            Want to know more, or meet the team?
          </h2>
          <p className="text-silver-400 text-sm mb-7 max-w-md mx-auto">
            We're happy to talk through how we work before you book — call, message us, or take a look at
            who's behind VVE Clean.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/team"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white font-bold px-6 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:bg-white hover:text-navy-900 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Meet the team
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-royal-500 hover:bg-royal-600 text-white font-bold px-6 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:shadow-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>

      </main>
      <Footer />

      <TrustPageMobileBar analyticsLocation="about_page_sticky" whatsappText={WA_TEXT} />
    </div>
  );
}
