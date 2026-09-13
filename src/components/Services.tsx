import { Link } from 'react-router-dom';
import type { HomepageQuoteService } from './HomeServiceSelector';
import { EOT_BASE_PRICES_P, CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P } from '../data/pricing';

const services = [
  { title: 'Carpet cleaning', href: '/carpet-cleaning-london', image: '/images/carpet-cleaning-hero.webp', alt: 'Extraction equipment cleaning a blue carpet', price: `Rooms from £${CARPET_ITEM_PRICES_P.bedroom / 100} · £${CARPET_MIN_BOOKING_P / 100} minimum`, description: 'Bedrooms, living rooms, stairs and hallways. Choose your rooms for a clear estimate.' },
  { title: 'Sofa & upholstery cleaning', href: '/sofa-cleaning-london', image: '/sofa_upholstery/web/gallery/sofa-gallery-01.webp', alt: 'A technician cleaning sofa upholstery', price: `2-seater £${CARPET_ITEM_PRICES_P.sofa_2 / 100} · £${CARPET_MIN_BOOKING_P / 100} minimum`, description: 'Fabric sofas, armchairs, mattresses and dining chairs. Delicate materials are assessed first.' },
  { title: 'End of tenancy cleaning', href: '/end-of-tenancy-cleaning-london', image: '/end_of_tenancy/before-after/kitchen1_after.jpg', alt: 'Kitchen hob after cleaning', price: `Complete from £${EOT_BASE_PRICES_P.studio / 100}`, description: 'Moving out of a vacant property? Compare Complete and Tailored, with oven cleaning included in both.' },
];

export default function Services({ onChoose }: { onChoose: (service: HomepageQuoteService) => void }) {
  return (
    <section id="services" className="scroll-mt-24 bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-royal-700">Find your service</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">What would you like cleaned?</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">Choose a service to see its scope, real work and price. Your preferred time starts as a free request.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {services.map((service) => (
            <article key={service.href} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Link to={service.href} tabIndex={-1} aria-hidden="true"><img src={service.image} alt="" width={800} height={480} loading="lazy" decoding="async" className="h-44 w-full object-cover sm:h-52" /></Link>
              <div className="p-5 sm:p-6">
                <h3 className="font-display text-xl font-bold text-navy-950"><Link to={service.href} className="hover:text-royal-700">{service.title}</Link></h3>
                <p className="mt-3 text-sm font-semibold text-royal-700">{service.price}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{service.description}</p>
                <Link to={`${service.href}#quote`} className="mt-4 inline-flex min-h-[44px] items-center text-sm font-bold text-royal-700 underline underline-offset-4">Build my estimate →</Link>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-5 py-4 text-sm">
          <span className="font-semibold text-navy-900">Also need:</span>
          <button type="button" onClick={() => onChoose('move_in')} className="min-h-[44px] font-medium text-royal-700 underline underline-offset-4">Move-in deep cleaning</button>
          <Link to="/after-builders-cleaning-london" className="inline-flex min-h-[44px] items-center font-medium text-royal-700 underline underline-offset-4">After builders cleaning</Link>
          <Link to="/commercial" className="inline-flex min-h-[44px] items-center font-medium text-royal-700 underline underline-offset-4">Commercial &amp; communal cleaning</Link>
        </div>
      </div>
    </section>
  );
}
