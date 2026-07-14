import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { CookieConsentProvider } from './context/CookieConsentContext';

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <CookieConsentProvider>
        <AppRoutes />
      </CookieConsentProvider>
    </StaticRouter>
  );
}
