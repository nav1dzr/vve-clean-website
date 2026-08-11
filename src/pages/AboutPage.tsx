import { Link } from 'react-router-dom';
import { Handshake, Tag, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { CONTACT_PHONE_TEL, CONTACT_PHONE_DISPLAY, WA_BASE } from '../data/contactDetails';

const WA_ABOUT = `${WA_BASE}?text=${encodeURIComponent("Hi VVE Clean! I'd like to know more about you.")}`;

const VALUES = [
  {
    icon: Handshake,
    title: 'Accountability',
    body: "If something isn't right, we come back and put it right — that's a promise, not a footnote.",
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
    title: 'Vetted & insured',
    body: 'Every cleaner is DBS-checked and we carry £5m public liability insurance as standard.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-[56px] lg:pb-0">
      <Navbar />
      <main id="main-content">

      {/* Hero */}
      <div className="navy-gradient pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Our Story</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Three friends, one better way to clean
          </h1>
          <p className="text-silver-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            VVE Clean was started by people who'd already done this job for other companies — and wanted
            to do it properly.
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
              Between them, they'd seen the same problems come up again and again — jobs rushed to hit a
              schedule, corners cut where no one was checking, and customers left chasing someone, anyone,
              when a clean fell short. None of it matched the standard they wanted to put their own name to.
            </p>
            <p>
              So they started VVE Clean to do it differently: fixed, honest pricing agreed before work
              begins, a team that turns up and finishes the job properly, and real accountability if
              something isn't right — a guarantee we stand behind, not a vague promise.
            </p>
            <p>
              That's still how we operate today. Every cleaner is DBS-checked and covered by £5m public
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

        {/* CTA */}
        <div className="mt-12 text-center bg-navy-950 rounded-2xl px-6 py-10">
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
            <a
              href="tel:02080502233"
              className="inline-flex items-center justify-center gap-2 text-silver-300 hover:text-white font-semibold px-6 py-3.5 min-h-[44px] text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Call {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>

      </main>
      <Footer />

      {/* Mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-silver-200 shadow-xl"
        style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}>
        <div className="grid grid-cols-2 divide-x divide-silver-200">
          <a href={CONTACT_PHONE_TEL}
            className="flex items-center justify-center gap-2 py-4 font-bold text-navy-900 text-sm active:bg-silver-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Call us
          </a>
          <a href={WA_ABOUT}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-4 font-bold text-white text-sm btn-whatsapp transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
