import { initialiseOptionalAnalytics } from '../lib/analytics';
import { useEffect } from 'react';
import { rememberEntry } from '../lib/attribution';

/** Remember the entry in memory; CookieConsentProvider publishes full choices. */
export default function CampaignAttribution() {
  useEffect(() => {
    rememberEntry();
    initialiseOptionalAnalytics();
  }, []);

  return null;
}
