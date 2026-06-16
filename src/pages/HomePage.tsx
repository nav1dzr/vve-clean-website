import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import TrustBadges from '../components/TrustBadges';
import QuoteCalculator from '../components/QuoteCalculator';
import Services from '../components/Services';
import Gallery from '../components/Gallery';
import OurKit from '../components/OurKit';
import Reviews from '../components/Reviews';
import Areas from '../components/Areas';
import FAQ from '../components/FAQ';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';

export default function HomePage() {
  return (
    <div className="min-h-screen mobile-page-bottom lg:pb-0">
      <Navbar />
      <Hero />
      <TrustBadges />
      <QuoteCalculator />
      <Services />
      <Gallery />
      <OurKit />
      <Reviews />
      <Areas />
      <Contact />
      <FAQ />
      <Footer />
      <MobileStickyFooter />
    </div>
  );
}
