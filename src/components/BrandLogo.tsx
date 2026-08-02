interface BrandLogoProps {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({
  inverse = false,
  compact = false,
  className = '',
}: BrandLogoProps) {
  const wordmarkColour = inverse ? 'text-white' : 'text-[#1268D9]';
  const detailColour = inverse ? 'text-sky-300' : 'text-[#1268D9]';
  const lineColour = inverse ? 'bg-sky-300' : 'bg-[#1268D9]';

  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <span className="sr-only">VVE Clean</span>

      <span
        aria-hidden="true"
        className={`${wordmarkColour} font-hero font-extrabold italic lowercase tracking-[-0.105em] ${
          compact
            ? 'text-[2.15rem]'
            : 'text-[2.6rem] sm:text-[2.8rem]'
        }`}
      >
        vve
      </span>

      <span
        aria-hidden="true"
        className={`mt-1 flex w-full items-center justify-center gap-1.5 ${detailColour}`}
      >
        <span className={`h-[2.5px] flex-1 rounded-full ${lineColour}`} />

        {/* Sized up to carry the same visual weight as the wordmark above.
            font-extrabold (800) is already as heavy as this typeface goes —
            index.html loads Bricolage Grotesque at 400..800, so font-black
            would clamp to the same weight or render as faux bold. Size and
            slightly thicker rules do the work instead. */}
        <span
          className={`${
            compact ? 'text-[10px]' : 'text-[11.5px]'
          } font-extrabold uppercase tracking-[0.18em]`}
        >
          Clean
        </span>

        <span className={`h-[2.5px] flex-1 rounded-full ${lineColour}`} />
      </span>
    </span>
  );
}
