const AREAS = [
  'Hackney', 'Islington', 'Shoreditch', 'Stratford', 'Canary Wharf',
  'Walthamstow', 'Bethnal Green', 'Dalston', 'Stoke Newington', 'Bow',
  'Hackney Wick', 'Hoxton', 'Poplar', 'Whitechapel', 'Clapton',
  'London Fields', 'Leyton', 'Finsbury Park', 'Angel', 'Old Street',
  'Mile End', 'Limehouse', 'Homerton', 'Forest Gate', 'Tottenham',
];

function AreaList({ hidden }: { hidden?: boolean }) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      aria-hidden={hidden ? 'true' : undefined}
    >
      {AREAS.map((area) => (
        <span key={area} className="inline-flex items-center flex-shrink-0">
          <span className="text-silver-400 font-sans text-[11px] font-medium tracking-[0.15em] uppercase whitespace-nowrap px-5">
            {area}
          </span>
          <span className="text-sky-400/50 select-none flex-shrink-0 text-[9px]" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </div>
  );
}

export default function AreaMarquee() {
  return (
    <div
      role="region"
      aria-label="Service areas — East and North London"
      tabIndex={0}
      className="bg-navy-950 border-b border-white/10 py-3 overflow-hidden group outline-none focus:ring-1 focus:ring-inset focus:ring-white/20"
    >
      <div
        className={[
          'flex',
          'animate-marquee',
          'motion-reduce:animate-none',
          'group-hover:[animation-play-state:paused]',
          'group-focus:[animation-play-state:paused]',
        ].join(' ')}
        style={{ width: 'max-content', willChange: 'transform' }}
      >
        {/* Real content — read once by screen readers */}
        <AreaList />

        {/* Decorative duplicate to fill the loop seamlessly */}
        <AreaList hidden />
      </div>
    </div>
  );
}
