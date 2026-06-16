import { MapPin } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const areas = [
  'Hackney', 'Islington', 'Shoreditch', 'Stratford', 'Canary Wharf',
  'Walthamstow', 'Bethnal Green', 'Dalston', 'Stoke Newington', 'Bow',
];

export default function Areas() {
  const { ref, visible } = useReveal();

  return (
    <section id="areas" ref={ref} className="py-24 bg-sky-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-2 bg-royal-500/10 border border-royal-500/20 rounded-full px-4 py-1.5 mb-4">
            <MapPin size={12} className="text-royal-600" />
            <span className="text-royal-600 text-xs tracking-widest font-semibold uppercase">Coverage</span>
          </div>
          <h2 className="section-heading mb-4">Areas We Cover</h2>
          <p className="section-subheading mx-auto">
            East &amp; North London specialists — covering E1, E2, E8, E9, E14, E15, E17, E20, N1, N4, N7 and N16.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-10">
          {areas.map((area, i) => (
            <div
              key={i}
              className={`bg-white rounded-xl px-3 py-3 flex items-center gap-2 shadow-sm border border-silver-200 hover:border-royal-300 hover:shadow-md transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <MapPin size={12} className="text-royal-500 flex-shrink-0" />
              <span className="text-navy-800 text-xs font-medium">{area}</span>
            </div>
          ))}
        </div>

        {/* Map placeholder / CTA strip */}
        <div
          className={`relative overflow-hidden rounded-2xl cyan-gradient p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              Don't see your area?
            </h3>
            <p className="text-slate-600 text-base">
              We also cover wider London — message us to confirm your postcode.
            </p>
          </div>
          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3">
            <a href="tel:+447845451111" className="btn-silver whitespace-nowrap">
              Call 07845 451111
            </a>
            <a href="#contact" className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-slate-800/30 text-slate-900 font-semibold rounded-lg transition-all duration-300 hover:bg-slate-900 hover:text-white text-sm whitespace-nowrap">
              Send a Message
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
