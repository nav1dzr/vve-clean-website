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
 *  2. As soon as the consent state is known, and on every later change, tell
 *     the attribution module. Granting advertising writes what was remembered
 *     at step 1, so a late "Accept" still credits the original click. Anything
 *     that is not a grant erases every advertising key.
 *
 * `categories.advertising === false` is treated as "no current permission"
 * whatever the reason — explicitly rejected, never answered, no stored record
 * at all, a corrupt record, or one written against a superseded consent
 * version. CookieConsentProvider already collapses all of those to false, and
 * none of them is an affirmative yes.
 *
 * An earlier version of this component only cleared on an explicit rejection,
 * reasoning that an unanswered banner was not a "no". That was wrong in the one
 * case that matters: visitors carrying advertising keys written by the
 * pre-consent implementation. For them, staying quiet meant the old data was
 * kept and still read at booking. There is no lawful basis for holding it, so
 * it goes, and it goes before the visitor has a chance to submit anything.
 *
 * What this deliberately does NOT clear is the in-memory entry snapshot from
 * step 1 — that is this visit's own URL, held in memory, and it is what gets
 * written if they go on to accept.
 *
 * Must be rendered inside CookieConsentProvider.
 */
export default function CampaignAttribution() {
  const { ready, categories } = useCookieConsent();

  useEffect(() => {
    rememberEntry();
  }, []);

  useEffect(() => {
    // `ready` is false until the stored choice has been read back. Acting
    // before then would clear a returning visitor's consented attribution for
    // a tick, and re-writing it costs a needless storage round-trip.
    if (!ready) return;
    setAdvertisingConsent(categories.advertising);
  }, [ready, categories.advertising]);

  return null;
}
