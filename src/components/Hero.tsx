import { ArrowRight } from 'lucide-react';
import { DEPOSIT_P, penceToDisplay } from '../data/pricing';
import GoogleBadge from './GoogleBadge';
import HomepagePhotoCarousel from './HomepagePhotoCarousel';

export default function Hero() {
  return (
    <section className="home-hero px-4 pb-8 pt-24 sm:px-6 sm:pb-14 sm:pt-32 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-royal-700">East &amp; North London</p>
          <h1 className="mt-3 font-hero text-[2rem] font-bold leading-[1.12] tracking-tight text-navy-950 sm:text-[2.8rem] lg:text-[3.25rem]">
            Carpet, sofa &amp; end-of-tenancy cleaning
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
            Choose your rooms, furniture or property size to see an estimate. We’ll agree the work and date with you.
          </p>
          <a href="#quote" className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-royal-600 px-6 py-3.5 font-semibold text-white hover:bg-royal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700 sm:w-auto">
            Get my price <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
            No payment to send your request. Once we agree the details, your {penceToDisplay(DEPOSIT_P)} deposit secures the booking and comes off your total.
          </p>
          <div className="mt-4"><GoogleBadge /></div>
        </div>
        <HomepagePhotoCarousel />
      </div>
    </section>
  );
}
