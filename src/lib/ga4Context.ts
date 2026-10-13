import { getStoredConsent } from './consent';
import { isPrivatePage } from './privatePage';

export interface Ga4BookingContext {
  measurement_id: string;
  client_id: string;
  session_id?: string;
  captured_at: string;
  consent_version: string;
  consent_recorded_at: string;
  analytics: true;
  advertising: boolean;
}

type Gtag = (...args: unknown[]) => void;
const CLIENT_ID = /^\d{1,20}\.\d{1,20}$/;
const SESSION_ID = /^\d{1,20}$/;

// Read Google-issued IDs only after analytics consent. No cookie parsing,
// synthetic IDs, customer fields or extra storage; unavailable tags fail closed.
export async function getGa4BookingContext(): Promise<Ga4BookingContext | null> {
  if (import.meta.env.VITE_GA4_BOOKING_MEASUREMENT_ENABLED !== 'true' || isPrivatePage()) return null;
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  const consent = getStoredConsent();
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (!/^G-[A-Z0-9]+$/.test(measurementId || '') || !consent?.analytics || typeof gtag !== 'function') return null;

  function read(field: string): Promise<unknown> {
    return new Promise(resolve => {
      const timer = window.setTimeout(() => resolve(null), 300);
      try {
        gtag?.('get', measurementId, field, (value: unknown) => {
          window.clearTimeout(timer);
          resolve(value);
        });
      } catch {
        window.clearTimeout(timer);
        resolve(null);
      }
    });
  }

  const [client, session] = await Promise.all([read('client_id'), read('session_id')]);
  // A withdrawal or changed choice while the callbacks were pending wins.
  const current = getStoredConsent();
  if (!current?.analytics || current.version !== consent.version ||
      current.timestamp !== consent.timestamp || current.advertising !== consent.advertising ||
      typeof client !== 'string' || !CLIENT_ID.test(client)) return null;
  const sessionId = typeof session === 'number' && Number.isSafeInteger(session) ? String(session) : session;
  return {
    measurement_id: measurementId,
    client_id: client,
    ...(typeof sessionId === 'string' && SESSION_ID.test(sessionId) ? { session_id: sessionId } : {}),
    captured_at: new Date().toISOString(),
    consent_version: consent.version,
    consent_recorded_at: consent.timestamp,
    analytics: true,
    advertising: consent.advertising,
  };
}
