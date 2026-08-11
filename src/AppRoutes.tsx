import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PricingPage from './pages/PricingPage';
import CommercialPage from './pages/CommercialPage';
import BookingPage from './pages/BookingPage';
import LeafletPage from './pages/LeafletPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import CarpetCleaningPage from './pages/CarpetCleaningPage';
import SofaCleaningPage from './pages/SofaCleaningPage';
import CommercialCarpetPage from './pages/CommercialCarpetPage';
import EndOfTenancyPage from './pages/EndOfTenancyPage';
import AfterBuildersPage from './pages/AfterBuildersPage';
import GalleryPage from './pages/GalleryPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import FaqPage from './pages/FaqPage';
import TeamPage from './pages/TeamPage';
import NotFoundPage from './pages/NotFoundPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/commercial" element={<CommercialPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/leaflet" element={<LeafletPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/carpet-cleaning-london" element={<CarpetCleaningPage />} />
      <Route path="/sofa-cleaning-london" element={<SofaCleaningPage />} />
      <Route path="/commercial-carpet-cleaning-london" element={<CommercialCarpetPage />} />
      <Route path="/end-of-tenancy-cleaning-london" element={<EndOfTenancyPage />} />
      <Route path="/after-builders-cleaning-london" element={<AfterBuildersPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/team" element={<TeamPage />} />
      {/* Client-side catch-all. This only covers in-app navigation to a bad
          link — the HTTP status for a cold request is decided by the server,
          via dist/404.html (prerender.mjs) and the absence of a catch-all
          rewrite in vercel.json. Both halves are needed. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
