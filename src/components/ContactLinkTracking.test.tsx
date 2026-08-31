import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import ContactLinkTracking from './ContactLinkTracking';

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

afterEach(() => {
  delete (window as GtagWindow).gtag;
  document.body.innerHTML = '';
});

describe('shared contact-link tracking', () => {
  it('tracks WhatsApp once from a genuine nested click', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;
    render(
      <>
        <ContactLinkTracking />
        <a href="https://wa.me/447845451111" data-track-location="test-wa" onClick={(event) => event.preventDefault()}>
          <span>WhatsApp</span>
        </a>
      </>,
    );

    fireEvent.click(document.querySelector('span')!);

    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'whatsapp_click', {
      event_category: 'engagement',
      event_label: 'test-wa',
    });
    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'conversion', {
      send_to: 'AW-18214693277/zzetCIy-6eEcEJ3TuO1D',
      event_label: 'test-wa',
    });
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it('tracks telephone links but not ordinary navigation', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;
    const { getByRole } = render(
      <>
        <ContactLinkTracking />
        <a href="tel:02080502233" onClick={(event) => event.preventDefault()}>Call</a>
        <a href="/pricing" onClick={(event) => event.preventDefault()}>Pricing</a>
      </>,
    );

    fireEvent.click(getByRole('link', { name: 'Call' }));
    fireEvent.click(getByRole('link', { name: 'Pricing' }));

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'phone_click', {
      event_category: 'engagement',
      event_label: '/:phone',
    });
  });

  it('removes its listener when unmounted', () => {
    const gtag = vi.fn();
    (window as GtagWindow).gtag = gtag;
    const { unmount } = render(<ContactLinkTracking />);
    unmount();

    const link = document.createElement('a');
    link.href = 'https://wa.me/447845451111';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.appendChild(link);
    fireEvent.click(link);

    expect(gtag).not.toHaveBeenCalled();
  });
});
