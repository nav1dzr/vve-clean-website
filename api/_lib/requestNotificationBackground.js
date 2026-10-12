import { waitUntil } from '@vercel/functions';

// Call only after the booking and its notification outbox have committed.
// Vercel keeps the delivery attempt alive after the response. The durable
// outbox remains the recovery source if the process cannot complete it.
export async function finishRequestNotifications(delivery) {
  if (process.env.VERCEL === '1') {
    try {
      // The pinned SDK silently no-ops without this context. Probe its host
      // bridge before using it so local/unsupported hosts still await delivery.
      const context = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
      if (typeof context?.waitUntil === 'function') {
        waitUntil(delivery);
        return;
      }
    } catch {
      // A host without the background hook must await this same attempt;
      // never start a second send or leave a promise unobserved.
      console.warn('[booking-request] background hook unavailable; awaiting delivery');
    }
  }
  await delivery;
}
