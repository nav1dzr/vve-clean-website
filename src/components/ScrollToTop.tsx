import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHashTarget } from '../lib/scrollToHash';
import { AREAS } from '../data/areas';
import { BLOG_POSTS_BY_SLUG } from '../data/blog';

const TITLES: Record<string, string> = {
  '/': 'VVE Clean London | Carpet, Sofa & End of Tenancy Cleaning',
  '/pricing': 'Cleaning Prices London | VVE Clean',
  '/commercial': 'Commercial & Communal Cleaning London | VVE Clean',
  '/booking': 'Request a Cleaning Time | VVE Clean',
  '/about': 'About VVE Clean | London Cleaning Company',
  '/contact': 'Contact VVE Clean | Call, WhatsApp or Email',
  '/faq': 'Cleaning Questions | VVE Clean FAQ',
  '/gallery': 'Cleaning Gallery | VVE Clean',
  '/blog': 'Cleaning & Moving Guides | VVE Clean',
  '/carpet-cleaning-london': 'Carpet Cleaning London | VVE Clean',
  '/sofa-cleaning-london': 'Sofa & Upholstery Cleaning London | VVE Clean',
  '/commercial-carpet-cleaning-london': 'Commercial Carpet Cleaning London | VVE Clean',
  '/end-of-tenancy-cleaning-london': 'End of Tenancy Cleaning London | VVE Clean',
  '/after-builders-cleaning-london': 'After Builders Cleaning London | VVE Clean',
  '/how-we-clean-carpets': 'How We Clean Carpets | VVE Clean',
  '/how-we-clean-sofas-upholstery': 'How We Clean Sofas & Upholstery | VVE Clean',
  '/how-we-clean-end-of-tenancy': 'How We Clean End of Tenancy | VVE Clean',
  '/privacy-policy': 'Privacy Policy | VVE Clean',
  '/terms-of-service': 'Terms of Service | VVE Clean',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const area = AREAS.find((item) => pathname === `/cleaning-${item.slug}`);
  if (area) return `Cleaning in ${area.name} | VVE Clean London`;
  const blogSlug = pathname.startsWith('/blog/') ? pathname.slice('/blog/'.length) : '';
  if (blogSlug && BLOG_POSTS_BY_SLUG[blogSlug]) return `${BLOG_POSTS_BY_SLUG[blogSlug].title} | VVE Clean`;
  return 'Page Not Found | VVE Clean';
}

// Mounted once, above <AppRoutes />, so it runs on every navigation —
// including a Link/navigate() to a same-page or cross-page "#quote" anchor,
// which React Router intercepts and never lets the browser scroll natively.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    document.title = titleFor(pathname);
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
