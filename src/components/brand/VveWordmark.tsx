// The official VVE Clean wordmark.
//
// IMPORTANT — read before changing anything here.
//
// This project has NO logo image asset. There is no logo.svg, no logo.png; the
// only brand raster files in public/ are favicons (favicon*.png/.ico,
// apple-touch-icon.png, android-chrome-*.png), which are square app icons, not
// the wordmark.
//
// The wordmark that appears in the site header is composed in markup, and this
// component is that exact markup lifted verbatim from Navbar.tsx so it can be
// reused without drifting. It is NOT a recreation, an approximation or an
// AI-generated substitute — it is the same letterforms, the same two-V
// treatment (outer letters #1c1917, middle V #b8960c), the same brand
// `font-display` face, the same widest tracking, and the same CLEAN sub-lockup
// framed by hairline gold rules.
//
// If a real vector wordmark is ever supplied, replace the internals of this one
// component with an <img>/<svg> and every usage updates at once.

const INK = '#1c1917';   // official charcoal — outer V and E, and CLEAN
const GOLD = '#b8960c';  // official gold — middle V and the hairline rules

export type WordmarkSize = 'sm' | 'md' | 'lg';

const SIZES: Record<WordmarkSize, { vve: string; clean: string; rule: string }> = {
  sm: { vve: 'text-xl',  clean: 'text-[7px]', rule: 'w-2.5' },
  md: { vve: 'text-2xl', clean: 'text-[8px]', rule: 'w-3' },
  lg: { vve: 'text-4xl', clean: 'text-[9px]', rule: 'w-4' },
};

export default function VveWordmark({
  size = 'md',
  className = '',
}: {
  size?: WordmarkSize;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`flex flex-col leading-none gap-0.5 ${className}`}>
      {/* VVE — outer letters charcoal, middle V gold */}
      <span
        className={`font-display font-bold tracking-widest leading-none ${s.vve}`}
        style={{ color: INK }}
      >
        <span>V</span><span style={{ color: GOLD }}>V</span><span>E</span>
      </span>
      {/* CLEAN with thin gold rules either side */}
      <span className="flex items-center gap-1.5">
        <span className={`block h-px ${s.rule}`} style={{ background: GOLD }} />
        <span
          className={`font-semibold uppercase tracking-[0.25em] ${s.clean}`}
          style={{ color: INK }}
        >
          CLEAN
        </span>
        <span className={`block h-px ${s.rule}`} style={{ background: GOLD }} />
      </span>
      <span className="sr-only">VVE Clean</span>
    </span>
  );
}
