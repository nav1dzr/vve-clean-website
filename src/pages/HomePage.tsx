import { useState } from 'react';
import { BookingProvider } from '../context/BookingContext';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import AreaMarquee from '../components/AreaMarquee';
import TrustBadges from '../components/TrustBadges';
import HomeServiceSelector, { type HomepageQuoteService } from '../components/HomeServiceSelector';
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
      <main id="main-content">
      <Hero />
      <AreaMarquee />
      <TrustBadges />
      <HomeServiceSelector onChoose={chooseService} />
      {/* Remounts on service change so every branch of the calculator starts
          from clean state rather than carrying the previous service's counts. */}
      <QuoteCalculator
        key={selectedQuoteService ?? 'homepage-empty'}
        homepageMode
        homepageService={selectedQuoteService}
        onHomepageServiceChange={setSelectedQuoteService}
      />
      <Reviews />
      <Gallery />
      <Guarantee />
      <OurKit />
      <Services />
      <Areas />
      <Contact />
      <FAQ />
      </main>
      <Footer />
      <MobileStickyFooter />
    </div>
    </BookingProvider>
  );
}
