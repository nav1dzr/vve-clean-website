import { useBookingCtx } from '../context/BookingContext';

const WA_HELP = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const CAL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export default function MobileStickyFooter() {
  const { state, waLink, onBook } = useBookingCtx();

  const handlePrimaryClick = () => {
    if (state === 'bookable') {
      onBook();
      return;
    }
    // Scroll to calculator, then trigger inline validation
    const el = document.getElementById('quote');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('vve:validate-book'));
    }, 500);
  };

  const helpLink = state === 'manual' ? waLink : WA_HELP;

  return (
    <div className="fixed left-0 right-0 z-50 lg:hidden" style={{ bottom: 'var(--vve-cookie-h, 0px)' }}>
      <div
        className="flex items-stretch shadow-[0_-4px_24px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Primary action */}
        {state === 'manual' ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold text-sm py-4 min-h-[44px] transition-colors duration-200 border-r border-white/20"
            aria-label="Request a quote via WhatsApp"
          >
            {WA_ICON}
            <span>Request a quote</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={handlePrimaryClick}
            className="flex-1 flex items-center justify-center gap-2 bg-royal-500 hover:bg-royal-600 active:bg-royal-700 text-white font-bold text-sm py-4 min-h-[44px] transition-colors duration-200 border-r border-white/20"
            aria-label={state === 'bookable' ? 'Book — pay £30 deposit' : 'Book online — select a service first'}
          >
            {CAL_ICON}
            <span>{state === 'bookable' ? 'Book — £30 deposit' : 'Book online'}</span>
          </button>
        )}

        {/* Secondary: Need help */}
        <a
          href={helpLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold text-sm py-4 min-h-[44px] transition-colors duration-200"
          aria-label="Need help? Chat on WhatsApp"
        >
          {WA_ICON}
          <span>Need help?</span>
        </a>
      </div>
    </div>
  );
}
