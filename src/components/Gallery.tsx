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

        <div
          className={`flex flex-col items-center gap-3 mt-10 transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <p className="text-navy-700 font-display text-lg font-semibold tracking-wide">
            Do You Want to <span className="italic">See More?</span>
          </p>
          <a
            href="https://www.instagram.com/vve__clean"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow VVE Clean on Instagram"
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Follow on Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
