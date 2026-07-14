import { Shield, CheckCircle, Star, Lock } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

// Exactly four verified items per the design spec — this is the site's one
// trust row; other sections should not repeat these same claims.
const badges = [
  { icon: Shield,      label: '£5m Public Liability',  sub: 'Fully insured' },
  { icon: CheckCircle, label: 'DBS Checked',            sub: 'Every cleaner vetted' },
  { icon: Star,        label: 'Real Google Reviews',    sub: '5.0 average rating' },
  { icon: Lock,        label: 'Secure Stripe Payment',  sub: 'Your card is never stored' },
];

export default function TrustBadges() {
  const { ref, visible } = useReveal();

  return (
    <section ref={ref} className="bg-surface py-10 border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {badges.map((badge, i) => (
            <div
              key={i}
              className={`flex flex-col items-center text-center bg-white border border-sky-200 rounded-xl p-4 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md hover:border-sky-400 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <badge.icon className="text-royal-500 mb-2" size={22} />
              <div className="text-navy-800 text-xs font-semibold mb-0.5">{badge.label}</div>
              <div className="text-slate-500 text-[10px]">{badge.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
