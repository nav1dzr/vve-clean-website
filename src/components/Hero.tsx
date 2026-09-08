import { ArrowRight } from 'lucide-react';
import GoogleBadge from './GoogleBadge';
import { useManagedWebsiteMedia } from '../lib/managedGalleryMedia';

export default function Hero() {
  const managedHero = useManagedWebsiteMedia('homepage-hero-image');
  const heroImage = managedHero?.type === 'photo' ? managedHero : null;
  return (
    <section className="home-hero px-4 pb-10 pt-28 sm:px-6 sm:pb-16 sm:pt-36 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-royal-700">VVE Clean · East &amp; North London</p>
          <h1 className="mt-4 font-hero text-[2.3rem] font-extrabold leading-[1.08] tracking-tight text-navy-950 sm:text-5xl lg:text-6xl">
            A cleaner home.<br /><span className="text-royal-700">A clear plan.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
            Carpet, upholstery and end of tenancy cleaning, with a clear scope and a team you can speak to directly.
          </p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a href="#quote" className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-royal-600 px-6 py-3.5 font-semibold text-white hover:bg-royal-700 sm:w-auto">
              Get my price <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#services" className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-navy-900 underline decoration-slate-300 underline-offset-4 hover:decoration-royal-600">Explore our services</a>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">Request a preferred time free. We agree the details with you before asking for a deposit.</p>
          <div className="mt-5"><GoogleBadge /></div>
          <p className="mt-4 text-sm text-slate-600">£5m public liability insurance · Professional equipment</p>
        </div>
        <figure className="service-photo">
          <img src={heroImage?.src || '/images/carpet-cleaning-hero.webp'} srcSet={heroImage?.srcSet} sizes={heroImage?.sizes || '(min-width: 1024px) 50vw, 100vw'} alt={heroImage?.alt || 'Extraction equipment cleaning a blue carpet'} width={1672} height={941} loading="eager" decoding="async" />
          <figcaption>
            <p className="font-display text-lg font-bold text-navy-950">{heroImage?.label || 'Carpet extraction in progress'}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">See the work behind the service, with full before-and-after photographs in our gallery.</p>
            <a href="/gallery?category=carpet" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-royal-700 underline underline-offset-4">Explore our cleaning work →</a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
