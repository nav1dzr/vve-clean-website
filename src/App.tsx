import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import ScrollToTop from './components/ScrollToTop';
import { CookieConsentProvider } from './context/CookieConsentContext';
import { captureAttribution } from './lib/attribution';

export default function App() {
  // Records utm_* / gclid on entry to ANY public route, not just /leaflet.
  // Without this, an ad click landing on the homepage or a service page reached
  // the booking form with no campaign data, so spend could not be tied to
  // revenue in the CRM. Runs once per page load; stores locally only — nothing
  // is transmitted until the customer submits a booking. In an effect, so it
  // never runs during SSR/prerender.
  useEffect(() => {
    captureAttribution();
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <CookieConsentProvider>
        <AppRoutes />
      </CookieConsentProvider>
    </BrowserRouter>
  );
}
