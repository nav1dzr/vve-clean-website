import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FAQ from '../components/FAQ';
import MobileStickyFooter from '../components/MobileStickyFooter';

export default function FaqPage() {
  return (
    <div className="mobile-page-bottom min-h-screen bg-white lg:pb-0">
      <Navbar />
      <main id="main-content" className="pt-16 lg:pt-20">
        <FAQ standalone />
      </main>
      <Footer />
      <MobileStickyFooter />
    </div>
  );
}
