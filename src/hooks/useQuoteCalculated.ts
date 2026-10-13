import { useCallback, useEffect, useRef } from 'react';
import { trackQuoteCalculated, trackQuoteStarted, type QuoteAnalyticsService } from '../lib/analytics';

// Initial/restored quotes are a baseline, not new user calculations. Signatures
// remain in memory: never send room selections or customer fields to analytics.
export function useQuoteCalculated(
  service: QuoteAnalyticsService | null,
  amountPence: number,
  eligible: boolean,
  signature: string,
): () => void {
  const seen = useRef(new Set([signature]));
  const initialSignature = useRef(signature);
  const started = useRef(new Set<QuoteAnalyticsService>());
  const recordStart = useCallback(() => {
    if (!service || started.current.has(service) || document.visibilityState !== 'visible') return;
    started.current.add(service);
    trackQuoteStarted(service);
  }, [service]);
  useEffect(() => {
    if (signature !== initialSignature.current) recordStart();
    if (!service || !eligible || seen.current.has(signature) ||
        !Number.isSafeInteger(amountPence) || amountPence <= 0) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible' || seen.current.has(signature)) return;
      seen.current.add(signature);
      trackQuoteCalculated(service, amountPence);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [service, amountPence, eligible, signature, recordStart]);
  return recordStart;
}
