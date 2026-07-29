import { Images } from 'lucide-react';

// One polished visual area reserved for a future controlled rotation of
// curated result photos. Deliberately static (no autoplay, no folder
// scanning) until the owner supplies an explicit, approved set of images —
// at that point this can be swapped for a real rotating component without
// changing the surrounding proof-section layout.
export default function RotatingResultsPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-dashed border-silver-300 bg-silver-50 aspect-video flex flex-col items-center justify-center gap-2"
      role="img"
      aria-label={`${label} — rotating results coming soon`}
    >
      <Images size={32} className="text-silver-400" aria-hidden="true" />
      <span className="text-silver-500 text-xs font-semibold tracking-widest uppercase">
        Rotating results — coming soon
      </span>
    </div>
  );
}
