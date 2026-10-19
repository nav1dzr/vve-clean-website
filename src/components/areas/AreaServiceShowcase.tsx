import { Link } from 'react-router-dom';
import { Armchair, KeyRound, Waves, type LucideIcon } from 'lucide-react';
import type { AreaInfo } from '../../data/areas';
import { getAreaShowcaseVideos } from '../../data/areaShowcase';
import { CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, EOT_BASE_PRICES_P, penceToDisplay } from '../../data/pricing';
import PriceTaxNote from '../PriceTaxNote';
import LazyVideo from '../media/LazyVideo';

type AreaServiceCard = {
  title: string;
  detail: string;
  price: string;
  priceScope: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
  iconColour: string;
  iconBackground: string;
};

const serviceCards: AreaServiceCard[] = [
  {
    title: 'End of tenancy cleaning',
    detail: 'For a full move-out clean, with oven cleaning included. Tailored is also available if you only need selected tasks.',
    price: `Complete from ${penceToDisplay(EOT_BASE_PRICES_P.studio)}`,
    priceScope: 'Studio flat with one bathroom',
    href: '/end-of-tenancy-cleaning-london',
    linkLabel: 'Compare tenancy packages',
    icon: KeyRound,
    iconColour: 'text-amber-700',
    iconBackground: 'bg-amber-50',
  },
  {
    title: 'Carpet cleaning',
    detail: 'Choose bedrooms, living rooms, stairs and hallways. We check the fibre and condition before treatment.',
    price: `Bedroom ${penceToDisplay(CARPET_ITEM_PRICES_P.bedroom)}`,
    priceScope: `${penceToDisplay(CARPET_MIN_BOOKING_P)} minimum visit`,
    href: '/carpet-cleaning-london',
    linkLabel: 'See carpet prices & methods',
    icon: Waves,
    iconColour: 'text-blue-700',
    iconBackground: 'bg-blue-50',
  },
  {
    title: 'Sofa & upholstery',
    detail: 'Sofas, armchairs and mattresses, with the fabric checked before treatment. Send a photo if you are unsure of the material.',
    price: `2-seater sofa ${penceToDisplay(CARPET_ITEM_PRICES_P.sofa_2)}`,
    priceScope: `${penceToDisplay(CARPET_MIN_BOOKING_P)} minimum visit`,
    href: '/sofa-cleaning-london',
    linkLabel: 'See sofa prices & fabric care',
    icon: Armchair,
    iconColour: 'text-emerald-700',
    iconBackground: 'bg-emerald-50',
  },
];

export default function AreaServiceShowcase({ area }: { area: AreaInfo }) {
  const videos = getAreaShowcaseVideos(area.slug);

  return (
    <section id="area-services" className="scroll-mt-28 border-y border-slate-200 bg-slate-50 px-4 py-12 sm:py-16" aria-labelledby={`${area.slug}-services-heading`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-3xl">
          <h2 id={`${area.slug}-services-heading`} className="font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">
            What would you like cleaned in {area.name}?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">Compare the service and starting price, then add your property details for a quote.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {serviceCards.map((service) => {
            const Icon = service.icon;
            return (
              <article key={service.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${service.iconBackground} ${service.iconColour}`} aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>
                  <h3 className="font-display text-xl font-bold text-navy-900">{service.title}</h3>
                </div>
                <p className="mt-5 text-lg font-bold text-navy-900">{service.price}</p>
                <p className="mt-1 text-sm text-slate-600">{service.priceScope}</p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">{service.detail}</p>
                <Link to={service.href} className="mt-5 inline-flex min-h-[44px] items-center font-semibold text-royal-700 underline decoration-royal-300 underline-offset-4 hover:text-royal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{service.linkLabel}</Link>
              </article>
            );
          })}
        </div>
        <PriceTaxNote className="mt-4" compact />

        {videos.length > 0 && (
          <div className="mt-10 border-t border-slate-200 pt-8">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h3 className="font-display text-2xl font-bold text-navy-900">Watch the cleaning in progress</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Clips from our work across London.</p>
              </div>
              <Link to="/gallery" className="inline-flex min-h-[44px] items-center font-semibold text-royal-700 underline decoration-royal-300 underline-offset-4 hover:text-royal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">View the full gallery</Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {videos.map((video) => (
                <figure key={video.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <LazyVideo video={{ src: video.src, poster: video.poster, description: video.description }} className="aspect-video w-full rounded-none" />
                  <figcaption className="p-4">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-royal-700">{video.service}</span>
                    <span className="mt-1 block font-semibold text-navy-900">{video.label}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}