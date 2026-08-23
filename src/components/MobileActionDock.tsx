import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Phone } from 'lucide-react';
import { useBookingCtx } from '../context/BookingContext';
import { trackPhoneClick, trackWhatsAppClick } from '../lib/analytics';
import { scrollToHashTarget } from '../lib/scrollToHash';
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, WA_BASE } from '../data/contactDetails';

// Single shared bottom action surface for every public page. Previously three
// near-identical implementations existed side by side (MobileStickyFooter,
// TrustPageMobileBar, plus inline clones on Pricing/Privacy/Terms) — any fix
// to the cookie-offset contract, icon set or copy had to be repeated in each
// one and regularly wasn't. Every page now renders this component with an
// explicit variant instead.

const DEFAULT_HELP_WA_TEXT = "Hi VVE Clean, I'd like to get a quote.";
const DEFAULT_HELP_WA = `${WA_BASE}?text=${encodeURIComponent(DEFAULT_HELP_WA_TEXT)}`;

// Published on <html> so page bottom-padding (.mobile-page-bottom in
// index.css) can reserve exactly this bar's real rendered height instead of
// a guessed constant — mirrors CookieConsentBanner's own
// COOKIE_BANNER_HEIGHT_VAR pattern for the same reason.
export const DOCK_HEIGHT_VAR = '--vve-dock-h';

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

type DockActionTone = 'primary' | 'outline' | 'whatsapp';

interface DockActionSpec {
  key: string;
  /** Short, non-truncating visible text. */
  label: string;
  /** Full, honest accessible name — always wins over `label` for AT users, so this carries any nuance the compact label can't. */
  ariaLabel?: string;
  icon: ReactNode;
  tone: DockActionTone;
  /** Internal paths (starting "/") render a router Link; tel:/https render a plain anchor; omitted renders a button. */
  href?: string;
  onClick?: () => void;
}

interface ResolvedActions {
  primary: DockActionSpec;
  secondaries: DockActionSpec[];
}

export type MobileActionDockProps =
  | {
      variant: 'calculator';
      /** Overrides the auto-derived (route-based) analytics location. */
      analyticsLocation?: string;
      /** Overrides the default "Need help?" WhatsApp destination — e.g. Leaflet keeps its scanned-leaflet context. */
      helpWaLink?: string;
      hidden?: boolean;
    }
  | {
      variant: 'general';
      analyticsLocation: string;
      whatsappText: string;
      primaryHref?: string;
      primaryLabel?: string;
      primaryAriaLabel?: string;
      hidden?: boolean;
    }
  | {
      variant: 'commercial';
      analyticsLocation: string;
      waLink: string;
      hidden?: boolean;
    };

// Scrolls to and moves accessible focus onto the real quote landmark — never
// dispatches a "you did something wrong" validation event. The old
// `scrollToQuoteAndValidate` was carried over from a previous design where
// the sticky bar's only button was always a "Book online" attempt, so a tap
// with nothing selected really was a failed booking attempt worth flagging.
// This button now says "Get a quote" — pure navigation, not a submission —
// so firing the calculator's inline validation error the instant someone
// arrives (before they've done anything) was never honest. Reuses the same
// scroll+focus utility every other "#quote" link in the app already relies
// on (ScrollToTop, service-page hero CTAs) instead of a bespoke one.
function goToQuote(): void {
  scrollToHashTarget('#quote');
}

function useResolvedActions(props: MobileActionDockProps): ResolvedActions | null {
  const { state, waLink, onBook } = useBookingCtx();
  const { pathname } = useLocation();

  if (props.variant === 'calculator') {
    // The EOT wizard's own sticky footer becomes the usable bottom action
    // surface once it's actually stuck/visible — a second fixed bar here
    // would stack on top of it. Before that (the whole hero/top-of-page
    // phase) and after it scrolls out of view, this dock is the only bottom
    // action surface, so it stays truthful ("Get a quote") rather than
    // disappearing entirely. See QuoteCalculator's eotFooterActive wiring.
    if (state === 'hidden') return null;

    const location = props.analyticsLocation ?? `mobile_dock:${pathname}`;
    const helpLink = props.helpWaLink ?? DEFAULT_HELP_WA;

    if (state === 'manual') {
      // Photo/tailored quotes: the primary action is the only real next step
      // (send photos), so the secondary must offer something else — previously
      // both buttons pointed at the same wa.me link.
      return {
        primary: {
          key: 'primary',
          label: 'Send photos',
          ariaLabel: 'Send photos for a quote on WhatsApp',
          icon: WA_ICON,
          tone: 'whatsapp',
          href: waLink,
          onClick: () => trackWhatsAppClick(location),
        },
        secondaries: [{
          key: 'call',
          label: 'Call',
          ariaLabel: `Call VVE Clean on ${CONTACT_PHONE_DISPLAY}`,
          icon: <Phone size={18} aria-hidden="true" />,
          tone: 'outline',
          href: CONTACT_PHONE_TEL,
          onClick: () => trackPhoneClick(location),
        }],
      };
    }

    const bookable = state === 'bookable';
    return {
      primary: bookable
        ? {
            key: 'primary',
            label: 'Book · £30 deposit',
            ariaLabel: 'Submit a booking request with a £30 deposit; your slot is confirmed separately.',
            icon: <Calendar size={18} aria-hidden="true" />,
            tone: 'primary',
            onClick: onBook,
          }
        : {
            key: 'primary',
            label: 'Get a quote',
            ariaLabel: 'Get a quote — go to the quote calculator',
            icon: <Calendar size={18} aria-hidden="true" />,
            tone: 'primary',
            onClick: goToQuote,
          },
      secondaries: [{
        key: 'help',
        label: 'Help',
        ariaLabel: 'Need help? Chat with VVE Clean on WhatsApp',
        icon: WA_ICON,
        tone: 'whatsapp',
        href: helpLink,
        onClick: () => trackWhatsAppClick(location),
      }],
    };
  }

  if (props.variant === 'general') {
    const location = props.analyticsLocation;
    const waLinkGeneral = `${WA_BASE}?text=${encodeURIComponent(props.whatsappText)}`;
    const primaryLabel = props.primaryLabel ?? 'Book';
    return {
      primary: {
        key: 'primary',
        label: primaryLabel,
        ariaLabel: props.primaryAriaLabel ?? props.primaryLabel ?? 'Book online',
        icon: <Calendar size={18} aria-hidden="true" />,
        tone: 'primary',
        // Always a real destination — never a same-page "#quote" scroll on a
        // page that has no calculator to scroll to.
        href: props.primaryHref ?? '/booking',
      },
      secondaries: [
        {
          key: 'call',
          label: 'Call',
          ariaLabel: `Call VVE Clean on ${CONTACT_PHONE_DISPLAY}`,
          icon: <Phone size={18} aria-hidden="true" />,
          tone: 'outline',
          href: CONTACT_PHONE_TEL,
          onClick: () => trackPhoneClick(location),
        },
        {
          key: 'wa',
          label: 'Chat',
          ariaLabel: 'Chat with VVE Clean on WhatsApp',
          icon: WA_ICON,
          tone: 'whatsapp',
          href: waLinkGeneral,
          onClick: () => trackWhatsAppClick(location),
        },
      ],
    };
  }

  // 'commercial'
  const location = props.analyticsLocation;
  return {
    primary: {
      key: 'primary',
      label: 'Site visit',
      ariaLabel: 'Book a free commercial site visit on WhatsApp',
      icon: WA_ICON,
      tone: 'whatsapp',
      href: props.waLink,
      onClick: () => trackWhatsAppClick(location),
    },
    secondaries: [{
      key: 'call',
      label: 'Call',
      ariaLabel: `Call VVE Clean on ${CONTACT_PHONE_DISPLAY}`,
      icon: <Phone size={18} aria-hidden="true" />,
      tone: 'outline',
      href: CONTACT_PHONE_TEL,
      onClick: () => trackPhoneClick(location),
    }],
  };
}

const ACTION_BASE =
  'inline-flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[12.5px] font-bold leading-tight transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:text-sm';

// Contrast, verified against the actual rendered tokens (not assumed):
// - primary: white on royal-700 (#0369a1) = 5.93:1 — passes AA (needs 4.5:1
//   at this 12.5–14px bold size, which does not qualify as "large text").
//   White on the previous royal-500 measured 2.77:1 and failed.
// - whatsapp: ink (#10243e) on the official #25d366 brand green = 7.88:1
//   base, 6.38:1 on the .btn-whatsapp hover shade, 5.03:1 on active — all
//   pass. White-on-green measured 1.98:1 and failed. The shared
//   `.btn-whatsapp` class (background + its hover/active colours) is reused
//   as-is — every other WhatsApp button on the site keeps its current white
//   text; only `text-ink` is added here, which is a Tailwind *utilities*
//   layer class and therefore safely wins over `.btn-whatsapp`'s
//   `@layer components` color rule without editing the shared class.
// - outline: white on ~rgb(27,35,58) (white/10 over navy-950) is >15:1,
//   comfortably passes; unaffected by this change.
const TONE_CLASS: Record<DockActionTone, string> = {
  primary: 'bg-royal-700 text-white hover:bg-navy-700 active:bg-navy-800',
  outline: 'border border-white/15 bg-white/10 font-semibold text-white hover:bg-white/15 active:bg-white/20',
  whatsapp: 'btn-whatsapp text-ink font-semibold',
};

function DockButton({ action, wide }: { action: DockActionSpec; wide?: boolean }) {
  const className = `${ACTION_BASE} ${TONE_CLASS[action.tone]} ${wide ? 'flex-[1.4]' : 'flex-1'}`;
  const ariaLabel = action.ariaLabel ?? action.label;
  const content = (
    <>
      <span aria-hidden="true" className="flex-shrink-0">{action.icon}</span>
      <span className="truncate">{action.label}</span>
    </>
  );

  if (action.href?.startsWith('/')) {
    return (
      <Link to={action.href} onClick={action.onClick} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }
  if (action.href) {
    const isHttp = action.href.startsWith('http');
    return (
      <a
        href={action.href}
        target={isHttp ? '_blank' : undefined}
        rel={isHttp ? 'noopener noreferrer' : undefined}
        onClick={action.onClick}
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} aria-label={ariaLabel} className={className}>
      {content}
    </button>
  );
}

const TEXT_INPUT_EXCLUDED_TYPES = new Set([
  'button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file', 'color', 'image',
]);

function isTextEntryElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName === 'INPUT') {
    return !TEXT_INPUT_EXCLUDED_TYPES.has((el as HTMLInputElement).type);
  }
  return false;
}

// A fixed bottom-0 bar is positioned against the layout viewport, not the
// visual one — on a phone keyboard opening, that can leave it sitting over
// the field the visitor is typing into rather than above the keyboard.
// Hiding it while a genuine text field outside the dock itself has focus
// keeps it clear of both without permanently removing it from any
// form-heavy page (Contact, the quote calculator's own inputs).
function useHideForKeyboard(navRef: RefObject<HTMLElement>): boolean {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const active = document.activeElement;
      if (navRef.current?.contains(active)) {
        setHide(false);
        return;
      }
      setHide(isTextEntryElement(active));
    };
    const onFocusOut = () => {
      // The element losing focus is still `document.activeElement` for one
      // more tick in some browsers/jsdom — defer so the *new* focus target
      // (if any) is what actually gets evaluated.
      window.setTimeout(evaluate, 0);
    };
    document.addEventListener('focusin', evaluate);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', evaluate);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [navRef]);

  return hide;
}

// Publishes this bar's real rendered height (border + padding + safe-area)
// on --vve-dock-h so page bottom-padding can reserve exactly enough room —
// see .mobile-page-bottom in index.css. A *regular* effect, not
// useLayoutEffect: this component is part of the prerendered HTML (entry-
// server.tsx renders every route with renderToString), unlike
// CookieConsentBanner, which only ever mounts client-side and can afford
// useLayoutEffect without triggering React's SSR warning. Every consumer's
// calc() carries a 72px fallback for the one tick before this publishes.
function usePublishHeight(navRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = navRef.current;
    const root = document.documentElement;
    if (!el) return undefined;
    const publish = () => root.style.setProperty(DOCK_HEIGHT_VAR, `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.removeProperty(DOCK_HEIGHT_VAR);
    }
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(DOCK_HEIGHT_VAR);
    };
  }, [navRef]);
}

export default function MobileActionDock(props: MobileActionDockProps) {
  const navRef = useRef<HTMLElement>(null);
  const hideForKeyboard = useHideForKeyboard(navRef);
  usePublishHeight(navRef);
  const resolved = useResolvedActions(props);

  if (props.hidden || hideForKeyboard || !resolved) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Quick actions"
      data-testid="mobile-action-dock"
      className="fixed inset-x-0 z-50 lg:hidden"
      // No transition on `bottom`: the cookie banner mounts a few hundred ms
      // after this bar and animating up to its height slid the bar through it
      // on every fresh mobile visit. See the offset/no-transition tests.
      style={{ bottom: 'var(--vve-cookie-banner-h, 0px)' }}
    >
      <div
        className="relative border-t border-white/10 bg-navy-950 px-2.5 pt-2.5 shadow-[0_-10px_30px_rgba(2,11,36,0.35)]"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-400 via-royal-500 to-sky-400"
        />
        <div className="mx-auto flex max-w-xl min-w-0 items-stretch gap-2">
          <DockButton action={resolved.primary} wide />
          {resolved.secondaries.map((action) => (
            <DockButton key={action.key} action={action} />
          ))}
        </div>
      </div>
    </nav>
  );
}
