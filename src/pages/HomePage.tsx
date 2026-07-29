import { BookingProvider } from '../context/BookingContext';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import AreaMarquee from '../components/AreaMarquee';
import TrustBadges from '../components/TrustBadges';
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
  return (
    <BookingProvider>
    <div className="min-h-screen mobile-page-bottom lg:pb-0">
      <Navbar />
      <Hero />
      <AreaMarquee />
      <TrustBadges />
      <QuoteCalculator />
      <Reviews />
      <Gallery />
      <Guarantee />
      <OurKit />
      <Services />
      <Areas />
      <Contact />
      <FAQ />
      <Footer />
      <MobileStickyFooter />
    </div>
    </BookingProvider>
  );
}
