import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import ScrollToTop from './components/ScrollToTop';
import { CookieConsentProvider } from './context/CookieConsentContext';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CookieConsentProvider>
        <AppRoutes />
      </CookieConsentProvider>
    </BrowserRouter>
  );
}
