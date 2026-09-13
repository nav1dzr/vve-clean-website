import { isValidElement, lazy } from 'react';
import { createRoutesFromElements, matchRoutes } from 'react-router-dom';
import { createRouteElements, type RoutePages } from './routeDefinitions';

// Each dynamic import is a page boundary. Unrelated pages remain unloaded.
const loaders = {
  HomePage: () => import('./pages/HomePage'),
  PricingPage: () => import('./pages/PricingPage'),
  CommercialPage: () => import('./pages/CommercialPage'),
  BookingPage: () => import('./pages/BookingPage'),
  BookingManagementPage: () => import('./pages/BookingManagementPage'),
  LeafletPage: () => import('./pages/LeafletPage'),
  PrivacyPolicyPage: () => import('./pages/PrivacyPolicyPage'),
  TermsOfServicePage: () => import('./pages/TermsOfServicePage'),
  CarpetCleaningPage: () => import('./pages/CarpetCleaningPage'),
  SofaCleaningPage: () => import('./pages/SofaCleaningPage'),
  CommercialCarpetPage: () => import('./pages/CommercialCarpetPage'),
  EndOfTenancyPage: () => import('./pages/EndOfTenancyPage'),
  AfterBuildersPage: () => import('./pages/AfterBuildersPage'),
  GalleryPage: () => import('./pages/GalleryPage'),
  AreaPage: () => import('./pages/AreaPage'),
  BlogIndexPage: () => import('./pages/BlogIndexPage'),
  BlogPostPage: () => import('./pages/BlogPostPage'),
  HowWeCleanCarpetsPage: () => import('./pages/HowWeCleanCarpetsPage'),
  HowWeCleanSofasPage: () => import('./pages/HowWeCleanSofasPage'),
  HowWeCleanEndOfTenancyPage: () => import('./pages/HowWeCleanEndOfTenancyPage'),
  NotFoundPage: () => import('./pages/NotFoundPage'),
  AboutPage: () => import('./pages/AboutPage'),
  ContactPage: () => import('./pages/ContactPage'),
  FaqPage: () => import('./pages/FaqPage'),
};

export const clientPages: RoutePages = {
  HomePage: lazy(loaders.HomePage),
  PricingPage: lazy(loaders.PricingPage),
  CommercialPage: lazy(loaders.CommercialPage),
  BookingPage: lazy(loaders.BookingPage),
  BookingManagementPage: lazy(loaders.BookingManagementPage),
  LeafletPage: lazy(loaders.LeafletPage),
  PrivacyPolicyPage: lazy(loaders.PrivacyPolicyPage),
  TermsOfServicePage: lazy(loaders.TermsOfServicePage),
  CarpetCleaningPage: lazy(loaders.CarpetCleaningPage),
  SofaCleaningPage: lazy(loaders.SofaCleaningPage),
  CommercialCarpetPage: lazy(loaders.CommercialCarpetPage),
  EndOfTenancyPage: lazy(loaders.EndOfTenancyPage),
  AfterBuildersPage: lazy(loaders.AfterBuildersPage),
  GalleryPage: lazy(loaders.GalleryPage),
  AreaPage: lazy(loaders.AreaPage),
  BlogIndexPage: lazy(loaders.BlogIndexPage),
  BlogPostPage: lazy(loaders.BlogPostPage),
  HowWeCleanCarpetsPage: lazy(loaders.HowWeCleanCarpetsPage),
  HowWeCleanSofasPage: lazy(loaders.HowWeCleanSofasPage),
  HowWeCleanEndOfTenancyPage: lazy(loaders.HowWeCleanEndOfTenancyPage),
  NotFoundPage: lazy(loaders.NotFoundPage),
  AboutPage: lazy(loaders.AboutPage),
  ContactPage: lazy(loaders.ContactPage),
  FaqPage: lazy(loaders.FaqPage),
};

/** Called after the pricebook resolves and before mounting the browser app. */
export async function preloadClientRoute(pathname: string) {
  const matches = matchRoutes(createRoutesFromElements(createRouteElements(clientPages)), pathname);
  const matchedElement = matches?.[matches.length - 1]?.route.element;
  const pageType = isValidElement(matchedElement) ? matchedElement.type : null;
  const name = (Object.keys(clientPages) as Array<keyof RoutePages>).find(key => clientPages[key] === pageType);
  if (!name) return;
  const page = await loaders[name]();
  // The first render can use the resolved component immediately, keeping the
  // prerendered content in place until its real interactive page is ready.
  Object.assign(clientPages, { [name]: page.default });
}
