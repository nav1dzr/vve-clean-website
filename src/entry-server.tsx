import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { CookieConsentProvider } from './context/CookieConsentContext';

// Re-exported so prerender.mjs (a plain Node script that cannot import .ts
// source directly) can generate its route list — and decide each area's
// indexability — from the same data and logic this app uses at runtime. This
// file is already compiled by the existing `vite build --ssr` step, so no
// new build plumbing is needed.
export { AREAS } from './data/areas';
export { areaHasRealProof } from './lib/areaProof';

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <CookieConsentProvider>
        <AppRoutes />
      </CookieConsentProvider>
    </StaticRouter>
  );
}
