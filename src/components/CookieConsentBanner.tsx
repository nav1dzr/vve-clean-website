import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

// Accept all / Reject optional share this exact base class list (only the
// colour pair differs) so neither reads as more prominent than the other.
const ACTION_BUTTON_BASE =
  'min-h-[44px] px-5 rounded-lg text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600';

export default function CookieConsentBanner() {
  const { acceptAll, rejectOptional, openSettings } = useCookieConsent();

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-silver-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)]"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-navy-900 text-sm leading-relaxed sm:max-w-xl">
          We use cookies that are essential for the site to work, and — only with your permission — analytics and
          advertising cookies.{' '}
          <Link to="/privacy-policy#cookies" className="text-royal-600 underline hover:text-royal-800">
            Privacy Policy
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          <button
            type="button"
            onClick={openSettings}
            className="min-h-[44px] px-3 text-sm font-medium text-royal-600 underline hover:text-royal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 rounded"
          >
            Manage choices
          </button>
          <button
            type="button"
            onClick={rejectOptional}
            className={`${ACTION_BUTTON_BASE} bg-white text-navy-900 border-2 border-navy-900 hover:bg-silver-50`}
          >
            Reject optional
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className={`${ACTION_BUTTON_BASE} bg-navy-900 text-white hover:opacity-90`}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
