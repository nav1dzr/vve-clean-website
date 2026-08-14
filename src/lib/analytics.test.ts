import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  trackBookingInitiated,
  trackContactFormSubmitted,
  trackPhoneClick,
  trackWhatsAppClick,
} from './analytics';

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

afterEach(() => {
  delete (window as GtagWindow).gtag;
});

describe('Google Ads analytics events', () => {
  it('keeps phone clicks as a generic event', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;

    trackPhoneClick('header');

    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith('event', 'phone_click', {
      event_category: 'engagement',
      event_label: 'header',
    });
  });

  it('sends booking starts to the dedicated secondary conversion action', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;

    trackBookingInitiated('Carpet cleaning');

    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'booking_initiated', {
      event_category: 'funnel',
      event_label: 'Carpet cleaning',
    });
    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'conversion', {
      send_to: 'AW-18214693277/cmLZCIm-6eEcEJ3TuO1D',
      event_label: 'Carpet cleaning',
    });
  });

  it('sends WhatsApp contacts to the dedicated secondary conversion action', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;

    trackWhatsAppClick('sticky-mobile-cta');

    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'conversion', {
      send_to: 'AW-18214693277/zzetCIy-6eEcEJ3TuO1D',
      event_label: 'sticky-mobile-cta',
    });
  });

  it('sends successful contact forms to the dedicated secondary conversion action', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;

    trackContactFormSubmitted();

    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'conversion', {
      send_to: 'AW-18214693277/XA4UCI--6eEcEJ3TuO1D',
    });
  });

  it('does nothing safely when gtag is unavailable', () => {
    expect(() => trackBookingInitiated('Carpet cleaning')).not.toThrow();
  });
});
