import type { ComponentType } from 'react';
import { Route } from 'react-router-dom';
import { AREAS, type AreaInfo } from './data/areas';

export interface RoutePages {
  HomePage: ComponentType;
  PricingPage: ComponentType;
  CommercialPage: ComponentType;
  BookingPage: ComponentType;
  BookingManagementPage: ComponentType;
  LeafletPage: ComponentType;
  PrivacyPolicyPage: ComponentType;
  TermsOfServicePage: ComponentType;
  CarpetCleaningPage: ComponentType;
  SofaCleaningPage: ComponentType;
  CommercialCarpetPage: ComponentType;
  EndOfTenancyPage: ComponentType;
  AfterBuildersPage: ComponentType;
  GalleryPage: ComponentType;
  AreaPage: ComponentType<{ area: AreaInfo }>;
  BlogIndexPage: ComponentType;
  BlogPostPage: ComponentType;
  HowWeCleanCarpetsPage: ComponentType;
  HowWeCleanSofasPage: ComponentType;
  HowWeCleanEndOfTenancyPage: ComponentType;
  NotFoundPage: ComponentType;
  AboutPage: ComponentType;
  ContactPage: ComponentType;
  FaqPage: ComponentType;
}

// One route table for the eager server pages and lazy browser pages.
export function createRouteElements(pages: RoutePages) {
  const { HomePage, PricingPage, CommercialPage, BookingPage, BookingManagementPage, LeafletPage, PrivacyPolicyPage, TermsOfServicePage, CarpetCleaningPage, SofaCleaningPage, CommercialCarpetPage, EndOfTenancyPage, AfterBuildersPage, GalleryPage, AreaPage, BlogIndexPage, BlogPostPage, HowWeCleanCarpetsPage, HowWeCleanSofasPage, HowWeCleanEndOfTenancyPage, NotFoundPage, AboutPage, ContactPage, FaqPage } = pages;
  return (
    <>
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/commercial" element={<CommercialPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/manage-booking" element={<BookingManagementPage />} />
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
    </>
  );
}
