import { useEffect, useState } from 'react';
import { BookingProvider } from '../context/BookingContext';
import EotQuotePremium from '../components/eot/premium/EotQuotePremium';
import { eotStateFromConfig, peekEotRestore } from '../components/eot/restoreEotQuote';
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

  // Read once, on mount, before anything renders. Only a pending "Back to
  // quote" carrying an End of Tenancy booking returns a value; every other
  // service's restore is still handled inside QuoteCalculator exactly as
  // before. Peeking rather than consuming matters: clearing the flag here
  // would break those other restores.
  const [eotRestore] = useState(peekEotRestore);

  // The premium quote is what reopens for a restored EOT booking, and it does
  // not read the flag itself, so clear it here. Without this a later homepage
  // visit in the same tab would silently rehydrate an old quote.
  useEffect(() => {
    if (eotRestore) sessionStorage.removeItem('vve_restore_quote');
  }, [eotRestore]);

  // End of Tenancy gets the same five-step premium journey as the service
  // page — the real EotQuotePremium, not a homepage copy of it — so the two
  // cannot drift apart in either pricing or presentation. It brings its own
  // id="quote" and its own mobile action bar, and suppresses the site-wide
  // sticky footer while mounted, so there is still exactly one of each.
  const showPremiumEot = selectedQuoteService === 'end_of_tenancy' || Boolean(eotRestore);

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
      {showPremiumEot ? (
        <EotQuotePremium
          initialState={eotRestore ? eotStateFromConfig(eotRestore) : undefined}
        />
      ) : (
        /* Remounts on service change so every branch of the calculator starts
           from clean state rather than carrying the previous service's counts. */
        <QuoteCalculator
          key={selectedQuoteService ?? 'homepage-empty'}
          homepageMode
          homepageService={selectedQuoteService}
          onHomepageServiceChange={setSelectedQuoteService}
        />
      )}
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
