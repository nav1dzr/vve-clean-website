import { useReveal } from '../hooks/useReveal';

const ticks = [
  'Commercial hot-water carpet extraction',
  'Professional pressure washing equipment',
  'Fully stocked van — nothing for you to provide',
];

export default function OurKit() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="py-20 px-4"
      style={{ background: 'linear-gradient(135deg, #0d1f2d 0%, #1a3347 50%, #0f2236 100%)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div
          className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Image */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl opacity-20" style={{ background: 'radial-gradient(circle, #c9a84c 0%, transparent 70%)' }} />
            <img
              src="/gallery/van-equipment.webp"
              alt="VVE Clean van and professional cleaning equipment"
              width={780}
              height={520}
              loading="lazy"
              decoding="async"
              className="relative w-full rounded-2xl shadow-2xl object-cover"
            />
          </div>

          {/* Text */}
          <div>
            <div className="inline-flex items-center gap-2 border border-amber-400/40 rounded-full px-4 py-1 mb-5">
              <span className="text-amber-400 text-xs tracking-widest font-bold uppercase">Our Kit</span>
            </div>

            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
              Professional machines,<br className="hidden sm:block" /> not household gear
            </h2>

            <p className="text-slate-300 text-base leading-relaxed mb-8">
              We turn up with commercial-grade equipment — carpet extraction, pressure washers and
              professional-grade products. The same kit the big agencies use, run by someone who
              actually shows up: the founder, on every job.
            </p>

            <ul className="space-y-3">
              {ticks.map((tick) => (
                <li key={tick} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: '#c9a84c', color: '#0d1f2d' }}
                  >
                    ✓
                  </span>
                  <span className="text-slate-200 text-sm leading-snug">{tick}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
