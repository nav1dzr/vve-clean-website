import { useBookingCtx } from '../context/BookingContext';
import MobileActionBar, { MOBILE_PRIMARY_CLASS, WhatsAppActionIcon } from './MobileActionBar';

const WA_HELP = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

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

  // A page that owns its own fixed bottom bar suppresses this one entirely.
  if (state === 'hidden') return null;

  const handlePrimaryClick = () => {
    if (state === 'bookable') {
      onBook();
      return;
    }
    // Scroll to calculator, then trigger inline validation
    const el = document.getElementById('quote');
    if (!el) {
      window.location.assign('/#quote');
      return;
    }
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('vve:validate-book'));
    }, 500);
  };

  const helpLink = state === 'manual' ? waLink : WA_HELP;

  return (
    <MobileActionBar
      whatsappHref={helpLink}
      primary={state === 'manual' ? (
        <a href={waLink} target="_blank" rel="noopener noreferrer" className={MOBILE_PRIMARY_CLASS} aria-label="Request a quote via WhatsApp">
          <WhatsAppActionIcon /><span>Request a quote</span>
        </a>
      ) : (
        <button type="button" onClick={handlePrimaryClick} className={MOBILE_PRIMARY_CLASS}>
          {CAL_ICON}
          <span>{state === 'bookable' ? 'Request a time · no payment' : 'Get my price'}</span>
        </button>
      )}
    />
  );
}
