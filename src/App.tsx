import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import ScrollToTop from './components/ScrollToTop';
import CampaignAttribution from './components/CampaignAttribution';
import { CookieConsentProvider } from './context/CookieConsentContext';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CookieConsentProvider>
        {/* Records utm_* / gclid on entry to ANY public route, not just
            /leaflet — without it an ad click landing on the homepage or a
            service page reached the booking form with no campaign data, so
            spend could not be tied to revenue in the CRM.

            Rendered inside the consent provider because it needs the visitor's
            advertising choice: the entry URL is held in memory on mount and
            only written to storage if advertising consent is granted. Nothing
            is transmitted until the customer submits a booking. */}
        <CampaignAttribution />
        <AppRoutes />
      </CookieConsentProvider>
    </BrowserRouter>
  );
}
