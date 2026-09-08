import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  trackBookingInitiated,
  trackBookingRequestSubmitted,
  trackContactFormSubmitted,
  trackPhoneClick,
  trackWhatsAppClick,
} from './analytics';

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };
beforeEach(() => {
  vi.stubGlobal('window', { location: new URL('https://www.vveclean.co.uk/') });
});

afterEach(() => {
  delete (window as GtagWindow).gtag;
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
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

  it('records a saved no-payment request as its own funnel event', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;

    trackBookingRequestSubmitted('Window cleaning');

    expect(gtag).toHaveBeenCalledOnce();
    expect(gtag).toHaveBeenCalledWith('event', 'request_submitted', {
      event_category: 'funnel',
      event_label: 'Window cleaning',
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
  it('never forwards customer details or private tokens as conversion identifiers', () => {
    const gtag = vi.fn(); (window as GtagWindow).gtag = gtag;
    for (const id of ['customer@example.com', 'N1SAM140926', '------------------------------------', 'private-management-token']) {
      trackBookingRequestSubmitted('Carpet cleaning', id); trackContactFormSubmitted(id);
    }
    expect(gtag).not.toHaveBeenCalled();
  });
  it('deduplicates saved requests and sends only a configured real request label', () => {
    const gtag = vi.fn(); (window as GtagWindow).gtag = gtag;
    vi.stubEnv('VITE_GOOGLE_ADS_REQUEST_CONVERSION_LABEL', 'AW-18214693277/testActualLabel');
    const id = '8f761dbb-8c42-4e26-95ba-e12c151277d6';
    trackBookingRequestSubmitted('Carpet cleaning', id); trackBookingRequestSubmitted('Carpet cleaning', id);
    expect(gtag).toHaveBeenCalledTimes(2);
    expect(gtag).toHaveBeenLastCalledWith('event', 'conversion', { send_to: 'AW-18214693277/testActualLabel', transaction_id: id });
  });
  it.each(['https://www.vveclean.co.uk/Manage-Booking?token=secret', 'https://www.vveclean.co.uk/%6danage-booking?token=secret', 'http://localhost:5173/', 'http://127.0.0.1:4173/', 'https://vve-clean-preview.vercel.app/'])(
    'does not measure private or preview URLs: %s', url => {
      vi.stubGlobal('window', { location: new URL(url), gtag: vi.fn() });
      trackPhoneClick('header'); trackBookingRequestSubmitted('Carpet cleaning'); trackContactFormSubmitted();
      expect((window as GtagWindow).gtag).not.toHaveBeenCalled();
    },
  );
  it('does not throw if an analytics provider fails after the enquiry was saved', () => {
    (window as GtagWindow).gtag = () => { throw new Error('provider unavailable'); };
    expect(() => trackContactFormSubmitted()).not.toThrow();
  });
});
