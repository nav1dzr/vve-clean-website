import { ArrowRight } from 'lucide-react';
import GoogleBadge from './GoogleBadge';
import HomepagePhotoCarousel from './HomepagePhotoCarousel';

export default function Hero() {
  return (
    <section className="home-hero px-4 pb-10 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-royal-700">VVE Clean · East &amp; North London</p>
          <h1 className="mt-4 font-hero text-[2.1rem] font-bold leading-[1.12] tracking-tight text-navy-950 sm:text-[2.8rem] lg:text-[3.25rem]">
            Carpet, sofa and end of tenancy cleaning <span className="text-royal-700">in London</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
            Choose what you need cleaned and check the price. Our team will agree the work and your preferred date with you.
          </p>
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a href="#quote" className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-royal-600 px-6 py-3.5 font-semibold text-white hover:bg-royal-700 sm:w-auto">
              Get my price <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#services" className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-navy-900 underline decoration-slate-300 underline-offset-4 hover:decoration-royal-600">Explore our services</a>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">No payment to request a time. The £30 deposit follows once we've agreed the details.</p>
          <div className="mt-5"><GoogleBadge /></div>
        </div>
        <HomepagePhotoCarousel />
      </div>
    </section>
  );
}
