import { Link } from 'react-router-dom';
import { Users, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { CHECKATRADE_URL, CHECKATRADE_LABEL } from '../data/contactDetails';
import { TEAM_GROUP_PHOTO } from '../data/team';

const TRUST_FACTS = [
  { icon: ShieldCheck, text: 'DBS-checked cleaners' },
  { icon: CheckCircle2, text: '£5m public liability insurance' },
  { icon: ShieldCheck, text: `${EOT_GUARANTEE_HOURS}-hour re-clean guarantee on Complete packages` },
];

// Homepage team-trust section — deliberately team-first, not a founder
// spotlight. Sits immediately after Reviews: proof that real customers are
// happy, then proof that a real accountable team stands behind it.
export default function TeamTrust() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      id="team"
      className="py-20 px-4 scroll-mt-24"
      style={{ background: '#F7FAFD' }}
    >
      <div
        className={`max-w-5xl mx-auto transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-royal-600 mb-3">
            ✦ Meet the Team
          </p>
          <h2 className="font-display font-bold text-navy-900 mb-4 leading-tight" style={{ fontSize: 'clamp(1.9rem, 5vw, 2.75rem)' }}>
            A real, accountable team
          </h2>
          <p className="text-silver-600 text-base max-w-2xl mx-auto leading-relaxed">
            VVE Clean was started by three friends who had each worked for different cleaning companies
            across London, and chose to build one team with shared standards instead of going their
            separate ways.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-center">
          {/* Reserved group-photo placeholder — 4:3, ready for a real photo */}
          <div className="lg:col-span-2">
            <div className="aspect-[4/3] w-full rounded-2xl bg-gradient-to-br from-navy-900 to-royal-700 flex items-center justify-center overflow-hidden">
              {TEAM_GROUP_PHOTO.url ? (
                <img src={TEAM_GROUP_PHOTO.url} alt={TEAM_GROUP_PHOTO.alt} className="h-full w-full object-cover" />
              ) : (
                <>
                  <Users aria-hidden="true" className="text-white/35" size={56} strokeWidth={1.25} />
                  <span className="sr-only">{TEAM_GROUP_PHOTO.alt}</span>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <ul className="space-y-3 mb-6">
              {TRUST_FACTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <Icon className="text-royal-500 flex-shrink-0 mt-0.5" size={19} aria-hidden="true" />
                  <span className="text-navy-800 text-sm sm:text-base font-medium">{text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={CHECKATRADE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-navy-950 hover:bg-navy-800 text-white font-bold px-5 py-3 min-h-[44px] rounded-full transition-all duration-300 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950"
              >
                {CHECKATRADE_LABEL}
                <ExternalLink size={15} aria-hidden="true" />
                <span className="sr-only">— independently vetted and reviewed, opens in a new tab</span>
              </a>
              <Link
                to="/team"
                className="inline-flex items-center justify-center gap-2 border-2 border-navy-900/20 hover:border-navy-900 text-navy-900 font-bold px-5 py-3 min-h-[44px] rounded-full transition-all duration-300 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950"
              >
                Meet the team
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
