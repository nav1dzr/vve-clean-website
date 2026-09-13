import HomePage from './pages/HomePage';
import PricingPage from './pages/PricingPage';
import CommercialPage from './pages/CommercialPage';
import BookingPage from './pages/BookingPage';
import BookingManagementPage from './pages/BookingManagementPage';
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
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import FaqPage from './pages/FaqPage';
import AppRoutes from './AppRoutes';

const pages = { HomePage, PricingPage, CommercialPage, BookingPage, BookingManagementPage, LeafletPage, PrivacyPolicyPage, TermsOfServicePage, CarpetCleaningPage, SofaCleaningPage, CommercialCarpetPage, EndOfTenancyPage, AfterBuildersPage, GalleryPage, AreaPage, BlogIndexPage, BlogPostPage, HowWeCleanCarpetsPage, HowWeCleanSofasPage, HowWeCleanEndOfTenancyPage, NotFoundPage, AboutPage, ContactPage, FaqPage };

// Prerender and synchronous route checks use real page components, never
// React.lazy placeholders. The browser imports ClientAppRoutes instead.
export default function ServerAppRoutes() {
  return <AppRoutes pages={pages} />;
}
