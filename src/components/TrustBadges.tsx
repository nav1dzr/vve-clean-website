import { Shield, Clock, CheckCircle, MapPin, PoundSterling } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const badges = [
  { icon: Shield,         label: 'Fully Insured',          sub: '£5M Public Liability' },
  { icon: CheckCircle,    label: 'Vetted Professionals',    sub: 'Background-Checked Team' },
  { icon: Clock,          label: 'Same-Day Available',      sub: 'Book by 10am' },
  { icon: PoundSterling,  label: 'Transparent Pricing',     sub: 'Clear Quotes, No Hidden Fees' },
  { icon: MapPin,         label: 'Local London Service',    sub: 'Providing Reliability Near You' },
  { icon: CheckCircle,    label: 'Satisfaction Guaranteed', sub: 'Or We Return Free' },
];

export default function TrustBadges() {
  const { ref, visible } = useReveal();

  return (
    <section ref={ref} className="bg-sky-50 py-10 border-b border-sky-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
