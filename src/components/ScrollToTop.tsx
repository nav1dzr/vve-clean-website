import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHashTarget } from '../lib/scrollToHash';
import { applyRouteMetadata } from '../lib/routeMetadata';
import { ROUTE_READY_EVENT } from '../lib/routeReady';

// Mounted once, above <AppRoutes />, so it runs on every navigation —
// including a Link/navigate() to a same-page or cross-page "#quote" anchor,
// which React Router intercepts and never lets the browser scroll natively.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    applyRouteMetadata(pathname);
    let timer: ReturnType<typeof setTimeout>;
    const focusDestination = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (hash) {
          scrollToHashTarget(hash);
          return;
        }
        window.scrollTo(0, 0);
        const heading = document.querySelector<HTMLElement>('main h1');
        if (!heading) return;
        heading.classList.add('route-focus-target');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }, 80);
    };
    focusDestination();
    window.addEventListener(ROUTE_READY_EVENT, focusDestination);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(ROUTE_READY_EVENT, focusDestination);
    };
  }, [pathname, hash]);

  return null;
}
