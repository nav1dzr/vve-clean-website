// Safe gtag event helper — no-ops silently if gtag is not loaded yet.
// Google Consent Mode v2 (configured in index.html and src/lib/consent.ts)
// manages whether signals are sent to Google; these calls are queued until
// consent is resolved and dropped if the user refuses analytics/ads.
//
// Event map (for GTM/Google Ads configuration):
//
// | Event                   | Trigger                                    | Component              | Key params                     |
// |-------------------------|--------------------------------------------|------------------------|--------------------------------|
// | phone_click             | User clicks a tel: link                    | Hero, Contact, Navbar  | location (string)              |
// | whatsapp_click          | User clicks a WhatsApp link                | Hero, Contact, CTAs    | location (string)              |
// | booking_initiated       | User clicks "Book Now" in calculator       | QuoteCalculator        | service_type (string)          |
// | contact_form_submitted  | Contact form POST succeeds                 | Contact                | —                              |
// | deposit_paid (GA4 conv) | Stripe payment confirmed (confirmation.html)| confirmation.html      | value, currency, transaction_id|
//
// Google Ads configuration (MANUAL REVIEW REQUIRED):
//   Primary conversion: AW-18214693277/hUwdCK68gswcEJ3TuO1D (deposit_paid, fires in confirmation.html)
//   Secondary conversions to configure: booking_initiated (micro-conversion)

type GtagEventParams = Record<string, string | number | boolean | undefined>;

function safeGtag(event: string, params?: GtagEventParams): void {
  const gtagFn = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtagFn !== 'function') return;
  gtagFn('event', event, params);
}

export function trackPhoneClick(location: string): void {
  safeGtag('phone_click', { event_category: 'engagement', event_label: location });
}

export function trackWhatsAppClick(location: string): void {
  safeGtag('whatsapp_click', { event_category: 'engagement', event_label: location });
}

export function trackBookingInitiated(serviceType: string): void {
  safeGtag('booking_initiated', { event_category: 'funnel', event_label: serviceType });
}

export function trackContactFormSubmitted(): void {
  safeGtag('contact_form_submitted', { event_category: 'engagement' });
}
