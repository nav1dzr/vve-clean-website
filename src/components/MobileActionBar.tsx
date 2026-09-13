import type { ReactNode } from 'react';

export const MOBILE_PRIMARY_CLASS = 'flex-[1.6] inline-flex min-w-0 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-sm font-bold leading-tight text-navy-950 shadow-sm transition-colors hover:bg-sky-400 active:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700';

export function WhatsAppActionIcon() { return (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
); }

// Shared presentation for the booking bar and pricing's service-aware links.
export default function MobileActionBar({ primary, whatsappHref }: { primary: ReactNode; whatsappHref: string }) {
  return (
    <nav
      aria-label="Quick booking and help"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white lg:hidden transition-none"
      // Explicitly disable transitions: the global reduced-motion duration would
      // otherwise give the default transition-property:all a brief bottom animation.
      style={{ bottom: 'var(--vve-cookie-banner-h, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch gap-2 px-3 py-2 shadow-[0_-4px_20px_rgba(16,36,62,0.06)]">
        {primary}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex min-w-0 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-bold text-navy-950 transition-colors hover:bg-[#31df72] active:bg-[#1ebe5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          data-track-location="sticky-footer-whatsapp"
          aria-label="WhatsApp — ask us about your clean"
        >
          <WhatsAppActionIcon />
          <span>WhatsApp</span>
        </a>
      </div>
    </nav>
  );
}
