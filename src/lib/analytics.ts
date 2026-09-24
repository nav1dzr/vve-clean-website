import { hasAdvertisingConsent } from './attribution';
import { canUseGoogleTags } from './privatePage';
// Safe gtag event helper — no-ops silently if gtag is not loaded yet.
// Google Consent Mode v2 (configured in index.html and src/lib/consent.ts)
// controls storage and signal processing. In denied mode Google may still
// receive cookieless signals; private booking pages send no events here.
//
// Event map (for GTM/Google Ads configuration):
//
// | Event                   | Trigger                                    | Component              | Key params                     |
// |-------------------------|--------------------------------------------|------------------------|--------------------------------|
// | phone_contact           | User clicks a tel: link                    | Hero, Contact, Navbar  | location (string)              |
// | whatsapp_contact        | User clicks a WhatsApp link                | Hero, Contact, CTAs    | location (string)              |
// | booking_initiated       | User clicks "Book Now" in calculator       | QuoteCalculator        | service_type (string)          |
// | booking_request_response_received | Browser receives saved response   | BookingPage            | service_type, opaque UUID      |
// | contact_form_submitted  | Contact form POST succeeds                 | Contact                | —                              |
// | legacy paid conversion | Verified historic Stripe payment only       | confirmation.html      | value, currency, transaction_id|
//
// Existing Google Ads labels are retained. Account-side goal/bidding settings
// must be reviewed separately; source code cannot establish their current state.
// The canonical booking_request_submitted conversion is created once by the
// durable server outbox. This browser-only response event is diagnostic and is
// neither a paid deposit nor a confirmed appointment.

const SECONDARY_ADS_CONVERSIONS = {
  bookingInitiated: 'AW-18214693277/cmLZCIm-6eEcEJ3TuO1D',
  whatsappContact: 'AW-18214693277/zzetCIy-6eEcEJ3TuO1D',
  contactFormSubmitted: 'AW-18214693277/XA4UCI--6eEcEJ3TuO1D',
} as const;

type GtagEventParams = Record<string, string | number | boolean | undefined>;

function canMeasure(): boolean {
  return canUseGoogleTags() && typeof (window as unknown as { gtag?: unknown }).gtag === 'function';
}

function safeGtag(event: string, params?: GtagEventParams): void {
  if (!canMeasure()) return;
  const gtagFn = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtagFn !== 'function') return;
  try { gtagFn('event', event, params); } catch { /* Measurement cannot turn a saved enquiry into a failed form. */ }
}

function safeAdsConversion(sendTo: string, params?: GtagEventParams): void {
  safeGtag('conversion', { send_to: sendTo, ...params });
}

export function trackPhoneClick(location: string): void {
  safeGtag('phone_contact', { event_category: 'engagement', event_label: location });
}

export function trackWhatsAppClick(location: string): void {
  safeGtag('whatsapp_contact', { event_category: 'engagement', event_label: location });
  safeAdsConversion(SECONDARY_ADS_CONVERSIONS.whatsappContact, { event_label: location });
}

export function trackBookingInitiated(serviceType: string): void {
  safeGtag('booking_initiated', { event_category: 'funnel', event_label: serviceType });
  safeAdsConversion(SECONDARY_ADS_CONVERSIONS.bookingInitiated, { event_label: serviceType });
}

export function trackBookingRequestSubmitted(serviceType: string, requestId?: string): void {
  if (!canMeasure() || !requestId || !UUID.test(requestId)) return;
  if (!once('request', requestId)) return;
  safeGtag('booking_request_response_received', { event_category: 'diagnostic', event_label: serviceType, transaction_id: requestId });
  // No direct Ads label: Google Ads receives booking_request_submitted from
  // the committed server record, so this acknowledgement cannot count it twice.
}

export function trackContactFormSubmitted(enquiryId?: string): void {
  if (!canMeasure() || (enquiryId !== undefined && !UUID.test(enquiryId))) return;
  if (enquiryId && !once('enquiry', enquiryId)) return;
  safeGtag('contact_form_submitted', { event_category: 'engagement' });
  safeAdsConversion(SECONDARY_ADS_CONVERSIONS.contactFormSubmitted, enquiryId ? { transaction_id: enquiryId } : undefined);
}

// UUIDs only: customer names, email, postcode references and private tokens
// must never become event parameters. Session storage prevents replay double counts.
const measured = new Set<string>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function once(kind: string, id: string): boolean {
  if (!UUID.test(id)) return false;
  const memoryKey = `${kind}_${id}`; if (measured.has(memoryKey)) return false; measured.add(memoryKey);
  if (!hasAdvertisingConsent()) return true;
  try { const key = `vve_measured_${kind}_${id}`; if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch { /* Measurement remains best effort. */ }
  return true;
}
export function trackFunnelStep(step: 'quote_start' | 'quote_complete' | 'request_start' | 'form_error', service: string): void {
  safeGtag(step === 'request_start' ? 'booking_request_started' : step, { event_category: 'funnel', event_label: service });
}
export function trackEmailClick(location: string): void { safeGtag('email_click', { event_category: 'engagement', event_label: location }); }

let ga4Started = false;
export function initialiseOptionalAnalytics(): void {
  if (ga4Started || !canMeasure()) return;
  const id = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  if (!/^G-[A-Z0-9]+$/.test(id || '')) return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  try { gtag('config', id, { send_page_view: true }); ga4Started = true; } catch { /* Analytics is optional. */ }
}
