import { useState } from 'react';
import { BookingProvider } from '../context/BookingContext';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import AreaMarquee from '../components/AreaMarquee';
import TrustBadges from '../components/TrustBadges';
import type { HomepageQuoteService } from '../components/HomeServiceSelector';
import QuoteCalculator from '../components/QuoteCalculator';
import Reviews from '../components/Reviews';
import Gallery from '../components/Gallery';
import Guarantee from '../components/Guarantee';
import OurKit from '../components/OurKit';
import Services from '../components/Services';
import Areas from '../components/Areas';
import Contact from '../components/Contact';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';

export default function HomePage() {
  const [selectedQuoteService, setSelectedQuoteService] = useState<HomepageQuoteService | null>(null);

  // End of Tenancy uses the same QuoteCalculator instance as every other
  // service (which hands off internally to the Complete/Tailored wizard) —
  // no separate homepage-only EOT branch, so pricing and presentation can
  // never drift between the homepage and the dedicated EOT service page.
  // A pending "Back to quote" restore (any service, including EOT) is read
  // generically by QuoteCalculator itself, exactly like every other service.

  // No hash handling here: #quote always exists — the calculator shows its
  // introductory panel until a service is chosen — so ScrollToTop, mounted once
  // above AppRoutes, scrolls and focuses it site-wide like any other anchor.

  // Used by the service cards, which sit above the quote and so need to bring
  // the customer down to it. Selecting from the dropdown inside the quote panel
  // calls setSelectedQuoteService directly instead: the panel is already on
  // screen, and scrolling it out from under the customer would be jarring.
  const chooseService = (service: HomepageQuoteService) => {
    setSelectedQuoteService(service);
    // Deferred a tick: the section remounts on selection, so the scroll has to
    // wait for the detailed calculator to take its place.
    window.setTimeout(() => {
      document.querySelector('#quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <BookingProvider>
    <div className="min-h-screen mobile-page-bottom lg:pb-0">
      <Navbar />
      {/* Section order follows the completion brief §9: promise, services,
          trust, proof, price entry, coverage, FAQ. Two constraints shaped it:

          - The single Services section can preselect the quote calculator,
            which remounts on service change so prices never carry across.
          - The quote journey is unchanged. #quote still resolves to the
            calculator, which is what the sticky bar, the 404 page and every
            "Get a quote" link scroll to. */}
      <main id="main-content">
      {/* 1. The promise */}
      <Hero />
      <AreaMarquee />

      {/* 2. Primary services */}
      <Services onChoose={chooseService} />

      {/* 5. Price / quote entry — the conversion point */}
      {/* Remounts on service change so every branch of the calculator starts
          from clean state rather than carrying the previous service's counts. */}
      <QuoteCalculator
        key={selectedQuoteService ?? 'homepage-empty'}
        homepageMode
        homepageService={selectedQuoteService}
        onHomepageServiceChange={setSelectedQuoteService}
      />
      {/* The guarantee sits immediately after the price, where it answers the
          objection the price raises. Detailed exclusions moved to
          /end-of-tenancy-cleaning-london#guarantee. */}
      <Guarantee />

      <section className="border-y border-slate-200 bg-white px-4 py-12" aria-labelledby="booking-steps-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="booking-steps-heading" className="font-display text-3xl font-bold text-navy-950">From request to confirmed visit</h2>
          <ol className="mt-7 grid gap-6 sm:grid-cols-3">
            {[
              ['01', 'Send your request', 'Choose the service and a preferred time. No payment is taken.'],
              ['02', 'Agree the details', 'We discuss the scope, final price and arrival window with you.'],
              ['03', 'Confirm with £30', 'Pay the deposit from your agreed offer. It counts towards the total; the remaining balance is normally due after the clean.'],
            ].map(([step, title, body]) => <li key={step}><p className="text-sm font-bold text-royal-700">{step}</p><h3 className="mt-2 font-display text-lg font-bold text-navy-950">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p></li>)}
          </ol>
        </div>
      </section>

      {/* Trust — who we are and what we bring */}
      <TrustBadges />
      <OurKit />

      {/* 4. Reviews and real results */}
      <Reviews />
      <Gallery />

      {/* 6. Coverage */}
      <Areas />

      {/* 7. Short FAQ, then direct contact for anything it does not answer */}
      <FAQ />
      <Contact />
      </main>
      <Footer />
      <MobileStickyFooter />
    </div>
    </BookingProvider>
  );
}
