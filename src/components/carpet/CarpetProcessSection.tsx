// The wide "equipment in action" block.
//
// This is the one landscape clip of the four, which is why it gets a full-width
// 16:9 stage of its own instead of sitting under a result card next to the
// portrait ones. It shows the machine actually working, which is the single
// thing a customer most wants to see before booking.
//
// No CTA button here on purpose: the mobile sticky footer already carries the
// primary action at every scroll position, and the page's own final CTA follows
// shortly after. Adding a third would put two competing primary actions on
// screen at once on mobile.

import LazyVideo from '../media/LazyVideo';
import { CARPET_PROCESS_VIDEO } from '../../data/carpetMedia';

export default function CarpetProcessSection() {
  const video = CARPET_PROCESS_VIDEO;
  if (!video) return null;

  return (
    <section
      id="process"
      className="scroll-mt-24 bg-navy-950 py-16 px-4"
      aria-label="Carpet cleaning process"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold leading-tight text-white md:text-4xl">
            Watch the equipment work
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-silver-300">
            The machine applies suitable cleaning solution and extracts loosened dirt and moisture
            from the carpet. The result and drying time depend on the fibre, condition and ventilation.
          </p>
        </div>

        <LazyVideo video={video} className="aspect-video w-full shadow-2xl" />
      </div>
    </section>
  );
}
