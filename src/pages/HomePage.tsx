import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import AreaMarquee from '../components/AreaMarquee';
import TrustBadges from '../components/TrustBadges';
import QuoteCalculator from '../components/QuoteCalculator';
import Services from '../components/Services';
import Gallery from '../components/Gallery';
import OurKit from '../components/OurKit';
import Reviews from '../components/Reviews';
import Guarantee from '../components/Guarantee';
import Areas from '../components/Areas';
import FAQ from '../components/FAQ';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';

export default function HomePage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector(hash);
    if (!el) return;
    const timer = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(timer);
  }, [hash]);

  return (
    <div className="min-h-screen mobile-page-bottom lg:pb-0">
      <Navbar />
      <Hero />
      <AreaMarquee />
      <TrustBadges />
      <QuoteCalculator />
      <Services />
      <Gallery />
      <OurKit />
      <Reviews />
      <Guarantee />
      <Areas />
      <Contact />
      <FAQ />
      <Footer />
      <MobileStickyFooter />
    </div>
  );
}
