import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

// Accept all / Reject optional share this exact base class list (only the
// colour pair differs) so neither reads as more prominent than the other.
const ACTION_BUTTON_BASE =
  'min-h-[44px] px-3 sm:px-5 rounded-lg text-xs sm:text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600';

// While the banner is visible it publishes its rendered height on this CSS
// variable so fixed bottom bars (MobileStickyFooter, pricing/legal sticky
// bars) can sit directly above it instead of being covered by it.
export const COOKIE_BANNER_HEIGHT_VAR = '--vve-cookie-banner-h';

export default function CookieConsentBanner() {
  const { acceptAll, rejectOptional, openSettings } = useCookieConsent();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    const root = document.documentElement;
    if (!el) return undefined;
    const publish = () => root.style.setProperty(COOKIE_BANNER_HEIGHT_VAR, `${el.offsetHeight}px`);
    publish();
    // jsdom (tests) and very old browsers lack ResizeObserver — the one-off
    // publish above still places the bars correctly in that case.
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.removeProperty(COOKIE_BANNER_HEIGHT_VAR);
    }
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(COOKIE_BANNER_HEIGHT_VAR);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-silver-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)] max-h-[45vh] overflow-y-auto"
    >
      <div className="max-w-5xl mx-auto px-3 py-2.5 sm:px-4 sm:py-4 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-navy-900 text-xs sm:text-sm leading-snug sm:leading-relaxed sm:max-w-xl">
          We use cookies that are essential for the site to work, and — only with your permission — analytics and
          advertising cookies.{' '}
          <Link to="/privacy-policy#cookies" className="text-royal-600 underline hover:text-royal-800">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 sm:flex-nowrap sm:justify-end">
          <button
            type="button"
            onClick={openSettings}
            className="min-h-[44px] px-1.5 sm:px-3 text-xs sm:text-sm font-medium text-royal-600 underline hover:text-royal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 rounded whitespace-nowrap"
          >
            Manage choices
          </button>
          <button
            type="button"
            onClick={rejectOptional}
            className={`${ACTION_BUTTON_BASE} bg-white text-navy-900 border-2 border-navy-900 hover:bg-silver-50 whitespace-nowrap`}
          >
            Reject optional
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className={`${ACTION_BUTTON_BASE} bg-navy-900 text-white hover:opacity-90 whitespace-nowrap`}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
