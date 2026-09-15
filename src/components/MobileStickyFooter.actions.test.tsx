import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileStickyFooter from './MobileStickyFooter';

const context = vi.hoisted(() => ({ state: 'none', waLink: 'https://wa.me/447845451111?text=Selected%20service', onBook: vi.fn() }));
vi.mock('../context/BookingContext', () => ({ useBookingCtx: () => context }));

afterEach(() => { context.state = 'none'; vi.clearAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('shared mobile actions preserve the booking journey', () => {
  it('uses the current booking callback only when the quote is ready', () => {
    context.state = 'bookable';
    render(<MobileStickyFooter landingAction={{ href: '#area-services', label: 'Choose my service' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Request a time · no payment' }));
    expect(context.onBook).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me/447845451111'));
  });

  it('preserves the selected service in a manual quote', () => {
    context.state = 'manual';
    render(<MobileStickyFooter />);
    expect(screen.getByRole('link', { name: 'Request a quote via WhatsApp' })).toHaveAttribute('href', context.waLink);
    expect(screen.getByRole('link', { name: 'Call VVE Clean about your quote' })).toHaveAttribute('href', 'tel:02080502233');
    expect(screen.queryByRole('link', { name: 'WhatsApp — ask us about your clean' })).not.toBeInTheDocument();
  });

  it('takes an unfinished quote to the calculator and respects reduced motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const scroll = vi.fn();
    const validate = vi.fn();
    const { container } = render(<><div id="quote" /><MobileStickyFooter /></>);
    container.querySelector('#quote')!.scrollIntoView = scroll;
    document.addEventListener('vve:validate-book', validate);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Get my price' }));
      expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
      vi.advanceTimersByTime(500);
      expect(validate).toHaveBeenCalledOnce();
      expect(context.onBook).not.toHaveBeenCalled();
    } finally { document.removeEventListener('vve:validate-book', validate); }
  });

  it('leaves pages with their own booking controls clear', () => {
    context.state = 'hidden';
    const { container } = render(<MobileStickyFooter />);
    expect(container).toBeEmptyDOMElement();
  });
});


describe('area page mobile actions', () => {
  it('keeps the service choice on the local page without triggering quote validation', () => {
    vi.useFakeTimers();
    const validate = vi.fn();
    document.addEventListener('vve:validate-book', validate);
    try {
      render(<MobileStickyFooter landingAction={{ href: '#area-services', label: 'Choose my service', helpHref: 'https://wa.me/447845451111?text=Islington' }} />);
      const primary = screen.getByRole('link', { name: 'Choose my service' });
      expect(primary).toHaveAttribute('href', '#area-services');
      expect(primary).not.toHaveAttribute('target');
      fireEvent.click(primary);
      vi.advanceTimersByTime(500);
      expect(context.onBook).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/447845451111?text=Islington');
    } finally { document.removeEventListener('vve:validate-book', validate); }
  });

  it('checks unconfirmed coverage through WhatsApp with a phone alternative', () => {
    const { container } = render(<MobileStickyFooter landingAction={{ href: 'https://wa.me/447845451111?text=Highgate', label: 'Check my postcode', isWa: true }} />);
    const primary = screen.getByRole('link', { name: 'Check my postcode' });
    expect(primary).toHaveAttribute('href', 'https://wa.me/447845451111?text=Highgate');
    expect(primary).toHaveAttribute('target', '_blank');
    expect(primary).toHaveAttribute('data-track-location', 'sticky-footer-whatsapp');
    expect(container.querySelectorAll('a[href^="https://wa.me/"]')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Call VVE Clean to check coverage' })).toHaveAttribute('href', 'tel:02080502233');
    expect(screen.queryByRole('button', { name: 'Get my price' })).not.toBeInTheDocument();
  });

  it('preserves manual and hidden quote modes when a landing action is present', () => {
    context.state = 'manual';
    const { rerender, container } = render(<MobileStickyFooter landingAction={{ href: '#area-services', label: 'Choose my service' }} />);
    expect(screen.getByRole('link', { name: 'Request a quote via WhatsApp' })).toHaveAttribute('href', context.waLink);
    expect(screen.queryByRole('link', { name: 'Choose my service' })).not.toBeInTheDocument();
    context.state = 'hidden';
    rerender(<MobileStickyFooter landingAction={{ href: '#area-services', label: 'Choose my service' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
