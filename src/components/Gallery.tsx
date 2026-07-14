import { useReveal } from '../hooks/useReveal';
import { BEFORE_AFTER_PAIRS } from '../data/services';

const beforeAfterPairs = BEFORE_AFTER_PAIRS;

// Always-visible side-by-side comparison — no hover/tap interaction required
// to see the result, so it reads correctly on first glance on mobile too.
// Standardised aspect ratio, crop and card height across every pair.
function BeforeAfterCard({ pair }: { pair: typeof beforeAfterPairs[number] }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-line bg-white">
      <div className="grid grid-cols-2">
        <div className="relative aspect-[4/3]">
          <img
            src={pair.before}
            alt={`${pair.label} — before cleaning`}
            width={600}
            height={450}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-navy-950/75 text-white">
            Before
          </span>
        </div>
        <div className="relative aspect-[4/3] border-l-2 border-white">
          <img
            src={pair.after}
            alt={`${pair.label} — after cleaning`}
            width={600}
            height={450}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute top-2 right-2 text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-success text-white">
            After
          </span>
        </div>
      </div>
      <div className="px-4 py-3">
        <span className="text-navy-900 font-semibold text-sm">{pair.label}</span>
      </div>
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
              <BeforeAfterCard pair={pair} />
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
