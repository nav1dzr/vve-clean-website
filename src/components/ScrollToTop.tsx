import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHashTarget } from '../lib/scrollToHash';
import { applyRouteMetadata } from '../lib/routeMetadata';

// Mounted once, above <AppRoutes />, so it runs on every navigation —
// including a Link/navigate() to a same-page or cross-page "#quote" anchor,
// which React Router intercepts and never lets the browser scroll natively.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    applyRouteMetadata(pathname);
    if (hash) {
      // Give the destination page/section a tick to render before measuring
      // its position (matters most just after a route change).
      const timer = setTimeout(() => scrollToHashTarget(hash), 80);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return;
      heading.classList.add('route-focus-target');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}
