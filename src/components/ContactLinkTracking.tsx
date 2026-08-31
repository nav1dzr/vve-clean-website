import { useEffect } from 'react';
import { trackPhoneClick, trackWhatsAppClick } from '../lib/analytics';

function trackingLocation(link: HTMLAnchorElement, channel: 'phone' | 'whatsapp'): string {
  const explicit = link.dataset.trackLocation?.trim();
  if (explicit) return explicit;

  const path = window.location.pathname || '/';
  return `${path}:${channel}`;
}

/**
 * Tracks genuine contact-link clicks from one shared listener.
 *
 * Keeping this at the application boundary means new pages and CTAs cannot
 * accidentally omit Google Ads/analytics coverage. Only a user's real click
 * on an anchor is counted; rendering, keyboard focus and programmatic URL
 * creation do not fire a conversion.
 */
export default function ContactLinkTracking() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;

      const href = link.getAttribute('href') ?? '';
      if (/^tel:/i.test(href)) {
        trackPhoneClick(trackingLocation(link, 'phone'));
        return;
      }

      if (/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\//i.test(href)) {
        trackWhatsAppClick(trackingLocation(link, 'whatsapp'));
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
