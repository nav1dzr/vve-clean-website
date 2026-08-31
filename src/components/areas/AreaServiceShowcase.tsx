import { Link } from 'react-router-dom';
import type { AreaInfo } from '../../data/areas';
import { getAreaShowcaseVideos } from '../../data/areaShowcase';
import { CARPET_MIN_BOOKING_P, EOT_BASE_PRICES_P } from '../../data/pricing';
import { SERVICE_IMAGES } from '../../data/services';

const serviceCards = [
  {
    title: 'End of tenancy cleaning',
    detail: 'Vacant-property cleaning to a published scope, with oven cleaning included.',
    price: `From £${EOT_BASE_PRICES_P.studio / 100}`,
    href: '/end-of-tenancy-cleaning-london',
    image: SERVICE_IMAGES.endOfTenancy,
  },
  {
    title: 'Carpet cleaning',
    detail: 'Hot-water extraction for suitable carpets, with the price built item by item.',
    price: `£${CARPET_MIN_BOOKING_P / 100} minimum visit`,
    href: '/carpet-cleaning-london',
    image: SERVICE_IMAGES.deepCleaning,
  },
  {
    title: 'Sofa & upholstery',
    detail: 'Fabric suitability checked first, with photo assessment where the material needs it.',
    price: `£${CARPET_MIN_BOOKING_P / 100} minimum visit`,
    href: '/sofa-cleaning-london',
    image: '/sofa_upholstery/web/gallery/sofa-gallery-01.webp',
  },
];

export default function AreaServiceShowcase({ area }: { area: AreaInfo }) {
  const videos = getAreaShowcaseVideos(area.slug);

  return (
    <section className="border-y border-slate-200 bg-slate-50 px-4 py-16" aria-labelledby={`${area.slug}-services-heading`}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-royal-700">Popular services</p>
          <h2 id={`${area.slug}-services-heading`} className="font-display text-3xl font-bold leading-tight text-navy-900 md:text-4xl">
            Three straightforward ways we can help in {area.name}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Compare the main services, then request a preferred time with no payment. The videos are examples from our real work across London and are not presented as {area.name}-specific jobs.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {serviceCards.map((service) => (
            <article key={service.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img src={service.image} alt="" loading="lazy" decoding="async" className="aspect-[16/8] w-full object-cover" />
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-royal-700">{service.price}</p>
                <h3 className="mt-2 font-display text-xl font-bold text-navy-900">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.detail}</p>
                <Link to={service.href} className="mt-5 inline-flex min-h-[44px] items-center font-semibold text-royal-700 underline decoration-royal-300 underline-offset-4 hover:text-royal-900">
                  See service details
                </Link>
              </div>
            </article>
          ))}
        </div>

        {videos.length > 0 && (
          <div className="mt-12">
            <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-royal-700">Equipment in action</p>
                <h3 className="mt-2 font-display text-2xl font-bold text-navy-900">Two real clips, refreshed daily</h3>
              </div>
              <Link to="/gallery" className="inline-flex min-h-[44px] items-center font-semibold text-royal-700 underline decoration-royal-300 underline-offset-4 hover:text-royal-900">
                View the full gallery
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {videos.map((video) => (
                <figure key={video.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <video controls playsInline preload="metadata" poster={video.poster} className="aspect-video w-full bg-navy-950 object-cover" aria-label={video.description}>
                    <source src={video.src} type="video/mp4" />
                    Your browser does not support embedded video.
                  </video>
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
