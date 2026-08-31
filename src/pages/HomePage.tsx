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

      {/* 3. Trust — who we are and what we bring */}
      <TrustBadges />
      <OurKit />

      {/* 4. Reviews and real results */}
      <Reviews />
      <Gallery />

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
