import { useEffect } from 'react';
import { useCookieConsent } from '../context/CookieConsentContext';
import { rememberEntry, setAdvertisingConsent } from '../lib/attribution';

/**
 * Wires campaign attribution to the visitor's cookie choice. Renders nothing.
 *
 * Two effects, in this order for a reason:
 *
 *  1. On mount, remember the entry URL — in memory only. This has to happen
 *     immediately, because by the time the banner is answered the visitor may
 *     be three pages deep and the ad's query string is long gone. Nothing is
 *     written to storage here and nothing is sent anywhere.
 *
 *  2. Whenever the consent state settles or changes, tell the attribution
 *     module. Granting advertising writes what was remembered at step 1, so a
 *     late "Accept" still credits the original click. Withdrawing it erases
 *     every advertising key.
 *
 * The `decided` check on the rejection path is deliberate. An unanswered banner
 * is not a rejection — it just means nothing may be written yet, which is
 * already true because consent is false. Treating it as a rejection would wipe
 * the attribution of a returning visitor who consented previously, purely
 * because the consent version had been bumped and they had not yet re-answered.
 * Storage is only cleared when the visitor has actually said no.
 *
 * Must be rendered inside CookieConsentProvider.
 */
export default function CampaignAttribution() {
  const { ready, decided, categories } = useCookieConsent();

  useEffect(() => {
    rememberEntry();
  }, []);

  useEffect(() => {
    // `ready` is false until the stored choice has been read back. Acting
    // before then would treat every returning visitor as undecided for a tick.
    if (!ready) return;
    if (categories.advertising) setAdvertisingConsent(true);
    else if (decided) setAdvertisingConsent(false);
  }, [ready, decided, categories.advertising]);

  return null;
}
