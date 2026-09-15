import { ArrowRight } from 'lucide-react';
import GoogleBadge from './GoogleBadge';
import HomepagePhotoCarousel from './HomepagePhotoCarousel';

export default function Hero() {
  return (
    <section className="home-hero relative isolate overflow-hidden px-4 pb-8 pt-24 sm:px-6 sm:pb-14 sm:pt-32 lg:px-8">
      <div className="relative mx-auto grid max-w-7xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-royal-700">VVE Clean · East &amp; North London</p>
          <h1 className="mt-4 font-hero text-[2.1rem] font-bold leading-[1.12] tracking-tight text-navy-950 sm:text-[2.8rem] lg:text-[3.25rem]">
            Carpet, sofa and end of tenancy cleaning <span className="text-royal-700">in London</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
            Check your cleaning price and request a date. We’ll confirm the details with you.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a href="#quote" className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-royal-600 px-6 py-3.5 font-semibold text-white hover:bg-royal-700 sm:flex-none">
              Get my price <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#services" className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-navy-900 underline decoration-slate-300 underline-offset-4 hover:decoration-royal-600">Services</a>
          </div>
          <p className="mt-3 text-sm text-slate-600">No payment to request or confirm your visit.</p>
          <div className="mt-4"><GoogleBadge variant="compact" /></div>
        </div>
        <HomepagePhotoCarousel />
      </div>
    </section>
  );
}
