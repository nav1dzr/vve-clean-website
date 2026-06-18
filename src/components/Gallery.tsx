import { useState } from 'react';
import { useReveal } from '../hooks/useReveal';
import { BEFORE_AFTER_PAIRS } from '../data/services';

const beforeAfterPairs = BEFORE_AFTER_PAIRS;

function BeforeAfterCard({ pair, delay }: { pair: typeof beforeAfterPairs[0]; delay: number }) {
  const [showAfter, setShowAfter] = useState(false);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-lg cursor-pointer select-none"
      onMouseEnter={() => setShowAfter(true)}
      onMouseLeave={() => setShowAfter(false)}
      onClick={() => setShowAfter((v) => !v)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Before image — always mounted, fades out */}
      <img
        src={pair.before}
        alt={`${pair.label} before`}
        width={600}
        height={400}
        loading="lazy"
        className={`w-full h-64 object-cover absolute inset-0 transition-opacity duration-500 ${showAfter ? 'opacity-0' : 'opacity-100'}`}
        draggable={false}
      />
      {/* After image — always mounted, fades in */}
      <img
        src={pair.after}
        alt={`${pair.label} after`}
        width={600}
        height={400}
        loading="lazy"
        className={`w-full h-64 object-cover transition-opacity duration-500 ${showAfter ? 'opacity-100' : 'opacity-0'}`}
        draggable={false}
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent pointer-events-none" />

      {/* Bottom row: title + badge */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-end justify-between pointer-events-none">
        <span className="text-white font-semibold text-sm drop-shadow">{pair.label}</span>
        <span
          className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full backdrop-blur-sm border transition-all duration-400 ${
            showAfter
              ? 'bg-green-500/80 border-green-400 text-white'
              : 'bg-white/15 border-white/30 text-white'
          }`}
        >
          {showAfter ? 'AFTER' : 'BEFORE'}
        </span>
      </div>

      {/* Top-right hint on hover */}
      <div
        className={`absolute top-3 right-3 pointer-events-none transition-opacity duration-300 ${showAfter ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
      />
    </div>
  );
}

export default function Gallery() {
  const { ref, visible } = useReveal();

  return (
    <section id="gallery" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-2 bg-royal-500/10 border border-royal-500/20 rounded-full px-4 py-1.5 mb-4">
            <span className="text-royal-600 text-xs tracking-widest font-semibold uppercase">Proof</span>
          </div>
          <h2 className="section-heading mb-4"> Real jobs, real results</h2>
          <p className="section-subheading mx-auto">
            Hover over any card — or tap on mobile — to reveal
            <br />
            Every photo below is from our own work — no stock images.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {beforeAfterPairs.map((pair, i) => (
            <div
              key={i}
              className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <BeforeAfterCard pair={pair} delay={i * 100} />
            </div>
          ))}
        </div>

        <p
          className={`text-center mt-8 text-silver-500 text-sm transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          Want to see more?{' '}
          <a
            href="https://www.instagram.com/vve__clean"
            target="_blank"
            rel="noopener noreferrer"
            className="text-royal-600 font-semibold hover:text-royal-700 underline underline-offset-2 transition-colors"
          >
            Follow us on Instagram
          </a>
        </p>
      </div>
    </section>
  );
}
