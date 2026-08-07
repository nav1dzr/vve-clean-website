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
import AreaPage from './pages/AreaPage';
import BlogIndexPage from './pages/BlogIndexPage';
import BlogPostPage from './pages/BlogPostPage';
import HowWeCleanCarpetsPage from './pages/HowWeCleanCarpetsPage';
import HowWeCleanSofasPage from './pages/HowWeCleanSofasPage';
import HowWeCleanEndOfTenancyPage from './pages/HowWeCleanEndOfTenancyPage';
import NotFoundPage from './pages/NotFoundPage';
import { AREAS } from './data/areas';

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
      {/* Generated from src/data/areas.ts so a route can never drift from the
          area's slug used by prerender.mjs and the sitemap. */}
      {AREAS.map((area) => (
        <Route key={area.slug} path={`/cleaning-${area.slug}`} element={<AreaPage area={area} />} />
      ))}
      <Route path="/blog" element={<BlogIndexPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/how-we-clean-carpets" element={<HowWeCleanCarpetsPage />} />
      <Route path="/how-we-clean-sofas-upholstery" element={<HowWeCleanSofasPage />} />
      <Route path="/how-we-clean-end-of-tenancy" element={<HowWeCleanEndOfTenancyPage />} />
      {/* Client-side catch-all. This only covers in-app navigation to a bad
          link — the HTTP status for a cold request is decided by the server,
          via dist/404.html (prerender.mjs) and the absence of a catch-all
          rewrite in vercel.json. Both halves are needed. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
