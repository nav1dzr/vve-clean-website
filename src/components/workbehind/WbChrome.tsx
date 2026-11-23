import { useEffect, useId, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import { useBookingCtx } from '../../context/BookingContext';
import { useCookieConsent } from '../../context/CookieConsentContext';
import '../../styles/work-behind.css';

// Shared frame for pages built in "The Work Behind" design: header, footer and
// the single mobile action. Contact details match the rest of the site.
export const WB_PHONE_DISPLAY = '020 8050 2233';
export const WB_PHONE_HREF = 'tel:02080502233';
export const WB_WHATSAPP_DISPLAY = '07845 451111';
export const WB_WHATSAPP_HREF = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';

const NAV = [
  { href: '/#services', label: 'Services' },
  { href: '/pricing', label: 'Prices' },
  { href: '/gallery', label: 'Our work' },
  { href: '/commercial', label: 'Commercial' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Internal links, including same-page "#quote" style links, go through the
 * router so ScrollToTop scrolls to and focuses the target, even on a repeat
 * tap when the URL already ends with that hash. Phone, mail and external
 * links stay plain anchors.
 */
export function WbLink({ href, children, ...rest }: { href: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return /^(#|\/(?!\/))/.test(href)
    ? <Link to={href} {...rest}>{children}</Link>
    : <a href={href} {...rest}>{children}</a>;
}

function NavAnchor({ href, children, onClick, className }: { href: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return <WbLink href={href} onClick={onClick} className={className}>{children}</WbLink>;
}

export function WbHeader({ ctaHref, ctaLabel = 'Get my price' }: { ctaHref: string; ctaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const close = () => setOpen(false);

  return (
    <header className="wb-top">
      <div className="wb-w">
        <div className="wb-top__bar">
          <Link to="/" className="wb-top__logo" aria-label="VVE Clean home"><BrandLogo inverse compact className="w-[74px]" /></Link>
          <nav aria-label="Main">{NAV.map(item => <NavAnchor key={item.href} href={item.href}>{item.label}</NavAnchor>)}</nav>
          <a className="wb-top__tel" href={WB_PHONE_HREF} data-track-location="navbar-phone">{WB_PHONE_DISPLAY}</a>
          <WbLink className="wb-btn wb-top__cta" href={ctaHref}>{ctaLabel}</WbLink>
          <button type="button" className="wb-top__menu" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        {open && (
          <div id={panelId} className="wb-top__panel">
            <nav aria-label="Main menu">
              {NAV.map(item => <NavAnchor key={item.href} href={item.href} onClick={close}>{item.label}</NavAnchor>)}
              <a href={WB_PHONE_HREF} onClick={close} data-track-location="navbar-phone">Call {WB_PHONE_DISPLAY}</a>
            </nav>
            <WbLink className="wb-btn" href={ctaHref} onClick={close}>{ctaLabel}</WbLink>
          </div>
        )}
      </div>
    </header>
  );
}

export function WbFooter() {
  const { openSettings } = useCookieConsent();
  return (
    <footer className="wb-foot">
      <div className="wb-w wb-foot__grid">
        <div>
          <b>VVE Clean</b>
          <p>VVE Limited trading as VVE Clean. Registered in England and Wales, company number 17234391. Registered office: 23-25 Queensway, London W2 4QP. No walk-ins; our teams work at your property.</p>
        </div>
        <div>
          <b>Services</b>
          <ul>
            <li><Link to="/carpet-cleaning-london">Carpet cleaning</Link></li>
            <li><Link to="/sofa-cleaning-london">Sofa cleaning</Link></li>
            <li><Link to="/end-of-tenancy-cleaning-london">End of tenancy</Link></li>
            <li><Link to="/after-builders-cleaning-london">After builders</Link></li>
            <li><Link to="/commercial">Commercial</Link></li>
          </ul>
        </div>
        <div>
          <b>Contact</b>
          <ul>
            <li><a href={WB_PHONE_HREF}>{WB_PHONE_DISPLAY}</a></li>
            <li><a href={WB_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">WhatsApp {WB_WHATSAPP_DISPLAY}</a></li>
            <li><a href="mailto:contact@vveclean.co.uk">contact@vveclean.co.uk</a></li>
          </ul>
        </div>
        <div>
          <b>Hours</b>
          <ul>
            <li>Mon to Fri, 9am to 6pm</li>
            <li>Sat and Sun, 10am to 3pm</li>
          </ul>
          <ul style={{ marginTop: 10 }}>
            <li><Link to="/pricing">Prices</Link></li>
            <li><Link to="/faq">Questions</Link></li>
            <li><Link to="/privacy-policy">Privacy</Link></li>
            <li><Link to="/terms-of-service">Terms</Link></li>
            <li><button type="button" className="wb-foot__btn" onClick={openSettings}>Cookie settings</button></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/**
 * The one mobile action. Follows the existing booking context: when the quote
 * on the page is complete it books, otherwise it takes the visitor to the
 * price. Hidden when the page's quote shows its own step bar, so two bars
 * never compete for the bottom of the screen.
 */
export function WbDock({ quoteHref, label = 'Get my price', watch }: { quoteHref: string; label?: string; watch?: string }) {
  const { state, waLink, onBook } = useBookingCtx();
  // On a page whose quote owns a step bar (End of Tenancy), keep the dock until
  // the quote reaches the screen, then step aside for the quote's own bar.
  const [quoteOnScreen, setQuoteOnScreen] = useState(false);
  useEffect(() => {
    if (!watch || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setQuoteOnScreen(entry.isIntersecting));
    // The quote can mount a moment after the page (it restores a saved quote
    // first), so keep looking briefly rather than giving up on the first try.
    let tries = 0;
    let timer = 0;
    const attach = () => {
      const target = document.querySelector(watch);
      if (target) observer.observe(target);
      else if (tries++ < 40) timer = window.setTimeout(attach, 250);
    };
    attach();
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [watch]);
  if (watch ? quoteOnScreen : state === 'hidden') return null;
  const whatsapp = state === 'manual' && waLink ? waLink : WB_WHATSAPP_HREF;
  return (
    <div className="wb-dock" role="region" aria-label="Quick actions">
      {state === 'bookable' && !watch
        ? <button type="button" className="wb-btn" onClick={onBook}>Request a time</button>
        : <WbLink className="wb-btn" href={quoteHref}>{label}</WbLink>}
      <a className="wb-btn wb-btn--line" href={whatsapp} target="_blank" rel="noopener noreferrer" data-track-location="sticky-footer-whatsapp">WhatsApp</a>
    </div>
  );
}

export function WbPage({ children, dock = true }: { children: ReactNode; dock?: boolean }) {
  return <div className={`wb${dock ? ' wb-with-dock' : ''}`}>{children}</div>;
}
