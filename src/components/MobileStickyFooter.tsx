import { Phone } from 'lucide-react';
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

export interface MobileLandingAction {
  href: string;
  label: string;
  isWa?: boolean;
  helpHref?: string;
}

export default function MobileStickyFooter({ landingAction }: { landingAction?: MobileLandingAction } = {}) {
  const { state, waLink, onBook } = useBookingCtx();

  // A page that owns its own fixed bottom bar suppresses this one entirely.
  if (state === 'hidden') return null;

  // Area pages choose a service or check coverage before reaching a calculator.
  // A ready/manual quote still takes precedence if a page later provides one.
  if (state === 'none' && landingAction) {
    const external = landingAction.href.startsWith('http');
    const primaryClass = landingAction.isWa
      ? 'flex-[1.6] inline-flex min-w-0 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-bold leading-tight text-navy-950 shadow-sm transition-colors hover:bg-[#31df72] active:bg-[#1ebe5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800'
      : MOBILE_PRIMARY_CLASS;
    return <MobileActionBar whatsappHref={landingAction.helpHref || WA_HELP}
      primary={<a href={landingAction.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        className={primaryClass} data-track-location={landingAction.isWa ? 'sticky-footer-whatsapp' : undefined}>
        {landingAction.isWa ? <WhatsAppActionIcon /> : CAL_ICON}<span>{landingAction.label}</span>
      </a>}
      secondary={landingAction.isWa ? <a href="tel:02080502233"
        className="flex-1 inline-flex min-w-0 min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700"
        aria-label="Call VVE Clean to check coverage"><Phone size={18} aria-hidden="true" /><span>Call us</span></a> : undefined} />;
  }

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
      secondary={state === 'manual' ? (
        <a href="tel:02080502233" className="flex-1 inline-flex min-w-0 min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700" aria-label="Call VVE Clean about your quote">
          <Phone size={18} aria-hidden="true" /><span>Call us</span>
        </a>
      ) : undefined}
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
