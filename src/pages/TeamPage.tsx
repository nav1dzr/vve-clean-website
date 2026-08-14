import { Link } from 'react-router-dom';
import { User, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TrustPageMobileBar from '../components/TrustPageMobileBar';
import { TEAM_SLOTS } from '../data/team';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { CHECKATRADE_URL, CHECKATRADE_LABEL } from '../data/contactDetails';
import { usePageMeta } from '../hooks/usePageMeta';

const WA_TEXT = "Hi VVE Clean! I'd like to know who I'll be dealing with.";

const TEAM_TRUST_FACTS = [
  { icon: ShieldCheck, text: 'Every cleaner is DBS-checked' },
  { icon: CheckCircle2, text: 'The team is covered by £5m public liability insurance' },
  { icon: ShieldCheck, text: `Every Complete end of tenancy clean carries our ${EOT_GUARANTEE_HOURS}-hour re-clean guarantee` },
];

export default function TeamPage() {
  usePageMeta(
    'Our Team | VVE Clean London',
    'Meet the people behind VVE Clean — a real, accountable team. Founding team and wider team profiles are on their way.',
    '/team',
  );

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-[56px] lg:pb-0">
      <Navbar />
      <main id="main-content">

      {/* Hero */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Our Team</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            The people behind VVE Clean
          </h1>
          <p className="text-silver-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            VVE Clean is run as a team. Full profiles for the founding team and the wider team are on
            their way — here's where they'll appear.
          </p>
        </div>
      </div>

      {/* Team grid */}
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEAM_SLOTS.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl border border-silver-200 bg-white overflow-hidden shadow-sm card-hover"
            >
              {/* Reserved aspect ratio so the layout doesn't shift once a real
                  photo replaces the placeholder. */}
              <div className="relative aspect-[4/5] w-full bg-gradient-to-br from-navy-900 to-royal-700 flex items-center justify-center">
                <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
                  {slot.groupLabel}
                </span>
                {slot.photoUrl ? (
                  <img src={slot.photoUrl} alt={slot.photoAlt} className="h-full w-full object-cover" />
                ) : (
                  // No sr-only duplicate here — the visible caption below
                  // already announces the same "coming soon" text once.
                  <User aria-hidden="true" className="text-white/35" size={64} strokeWidth={1.25} />
                )}
              </div>
              <div className="p-5 text-center">
                <p className="font-display text-base font-bold text-navy-900">
                  {slot.name ?? 'Photo and profile coming soon'}
                </p>
                {slot.role && (
                  <p className="mt-1 text-sm text-silver-500">{slot.role}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Supported team trust facts */}
        <div className="mt-10 bg-white rounded-2xl border border-silver-200 shadow-sm p-6 md:p-8">
          <h2 className="font-display text-lg font-bold text-navy-900 mb-4 text-center">
            What we can already tell you about the team
          </h2>
          <ul className="grid sm:grid-cols-3 gap-4">
            {TEAM_TRUST_FACTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="text-royal-500 flex-shrink-0 mt-0.5" size={18} aria-hidden="true" />
                <span className="text-silver-700 text-sm leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Independent proof */}
        <div className="mt-6 bg-white rounded-2xl border border-silver-200 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-navy-900 mb-1">Independently vetted</h2>
            <p className="text-silver-600 text-sm">
              VVE Limited is listed and reviewed on Checkatrade.
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
            Want the full story first?
          </h2>
          <p className="text-silver-400 text-sm mb-7 max-w-md mx-auto">
            Read how and why VVE Clean started, or get in touch directly with any questions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/about"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white font-bold px-6 py-3.5 min-h-[44px] rounded-full transition-all duration-300 hover:bg-white hover:text-navy-900 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Our story
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

      <TrustPageMobileBar analyticsLocation="team_page_sticky" whatsappText={WA_TEXT} />
    </div>
  );
}
